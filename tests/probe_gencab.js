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
  const M = await page.evaluate(() => {
    window.__me = { id: 'u1', role: 'agency_owner', agency_id: 'a1' }; window.tMe = () => window.__me;
    const nav = () => document.querySelector('#app-ag .nav-i[data-m="finance"]');
    const снимок = () => { applyAgencyPerms(); return {
      выключен: agModuleOff('finance'),
      пункт: nav() ? getComputedStyle(nav()).display : 'нет узла',
      право: agCanView('finance'),
      вПравах: _permKeys().indexOf('finance') >= 0 }; };
    const ново = снимок();
    window.__me.agencyModules = { finance: true };
    const включено = снимок();
    window.__me.agencyModules = {};
    const обратно = снимок();
    /* пустое поле и отсутствие поля — одно и то же: неизвестно значит нет */
    window.__me.agencyModules = { finance: false };
    const явноВыключено = снимок();
    delete window.__me.agencyModules;
    return { ново, включено, обратно, явноВыключено,
      опциональные: (typeof AG_MODULES_OPT !== 'undefined') ? AG_MODULES_OPT.slice() : null,
      обычныйНеОпционален: agModuleOff('projects') };
  });
  ok('у нового агентства раздела нет: ни пункта, ни права, ни строки в правах',
    M.ново.выключен === true && M.ново.пункт === 'none'
    && M.ново.право === false && M.ново.вПравах === false, M.ново);
  ok('включили из генерального — раздел появился целиком',
    M.включено.выключен === false && M.включено.пункт !== 'none'
    && M.включено.право === true && M.включено.вПравах === true, M.включено);
  ok('выключили — пропал так же целиком',
    M.обратно.выключен === true && M.обратно.пункт === 'none' && M.обратно.вПравах === false, M.обратно);
  ok('явно выключенный и никогда не включённый — одно и то же',
    M.явноВыключено.выключен === true && M.явноВыключено.пункт === 'none', M.явноВыключено);
  ok('опциональным помечен только тот раздел, который правда опционален',
    Array.isArray(M.опциональные) && M.опциональные.join(',') === 'finance'
    && M.обычныйНеОпционален === false, M.опциональные);

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

  console.log(errs.length ? 'ОШИБКИ: ' + JSON.stringify(errs.slice(0, 3)) : '');
  ok('страница не бросила ни одной ошибки', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(`\n${pass} ok · ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
