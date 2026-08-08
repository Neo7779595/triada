/* probe_empwin — окно сотрудника: раскладка, навигация, каскад прав, вход */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'detroyd', role: 'agency_owner', agency_id: 'AG', agencySlug: 'detroyd' };
  window.tMe = () => window.__me;
  window.__toasts = []; window.toast = t => { window.__toasts.push(t); };
  window.LIVE = false;
  window.renderTeam = () => {};
  PROJECTS = ['Стелла', 'Ресто', 'Барбер', 'Кофейня', 'Клиника', 'Автосервис', 'Пекарня', 'Цветы', 'Фитнес', 'Отель']
    .map((n, i) => ({ id: 'p' + i, name: n, logo: n[0], logoUrl: null, status: 'active', _team: [] }));
  TEAM = [{ _id: 'm1', name: 'Пётр Смирнов', role: 'Монтажёр', dept: 'Продакшн', color: '#8A8FFF',
    login: 'petr', phone: '+998901112233', tg: '@petr', google_email: 'petr@gmail.com',
    is_pm: false, is_director: false, perms: null }];
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup);

  /* ——— A. режим создания ——— */
  console.log('\n[A] создание');
  await page.evaluate(() => openEmp());
  await page.waitForTimeout(300);
  const ids = ['e-name', 'e-role', 'e-dept', 'e-sw', 'e-phone', 'e-tg', 'e-gmail', 'e-login', 'e-pass', 'e-email',
    'e-perms', 'e-prj-fld', 'e-prj-hint', 'e-prj-t-all', 'e-prj-t-asg', 'e-prj-list-host', 'e-prj-foot',
    'e-dir', 'e-dir-card', 'e-pm', 'e-pm-card', 'e-bill', 'e-bill-card', 'e-docs', 'e-docs-card',
    'e-access-sub', 'emp-title', 'emp-save', 'emp-del'];
  const missing = await page.evaluate(l => l.filter(i => !document.getElementById(i)), ids);
  ok('все поля прежней карточки на месте', missing.length === 0, missing);
  ok('окно открыто', await page.evaluate(() => document.getElementById('ov-emp').classList.contains('on')));
  ok('заголовок «Новый сотрудник»', await page.evaluate(() => document.getElementById('emp-title').textContent.trim()) === 'Новый сотрудник');
  ok('кнопка «Создать сотрудника»', await page.evaluate(() => document.getElementById('emp-save').textContent.trim()) === 'Создать сотрудника');
  ok('«Удалить сотрудника» скрыта', await page.evaluate(() => document.getElementById('emp-del').style.display) === 'none');
  ok('фокус в поле имени', await page.evaluate(() => document.activeElement && document.activeElement.id) === 'e-name');
  ok('логин доступен для ввода', await page.evaluate(() => !document.getElementById('e-login').readOnly));
  ok('четыре пункта навигации', await page.evaluate(() => document.querySelectorAll('#empw-nav .empw-nav-i').length) === 4);

  /* ——— B. шапка живая ——— */
  console.log('\n[B] шапка и превью');
  await page.fill('#e-name', 'Иван Иванов');
  await page.fill('#e-role', 'Дизайнер');
  await page.waitForTimeout(80);
  ok('буква в аватаре шапки', await page.evaluate(() => document.getElementById('empw-av').textContent) === 'И');
  ok('имя в карточке превью', await page.evaluate(() => document.getElementById('empw-card-nm').textContent) === 'Иван Иванов');
  const sub = await page.evaluate(() => document.getElementById('empw-sub').textContent);
  ok('под заголовком роль и команда', /Дизайнер/.test(sub) && /Продакшн/.test(sub), sub);
  ok('бейдж «Сотрудник»', await page.evaluate(() => document.getElementById('empw-badge').textContent) === 'Сотрудник');
  await page.evaluate(() => pickEmpColor('#F0785C', document.querySelectorAll('#e-sw .sw')[4]));
  await page.waitForTimeout(60);
  ok('цвет уезжает в аватар', await page.evaluate(() => empColor === '#F0785C' && /240, 120, 92|#F0785C/.test(document.getElementById('empw-av').style.background)));

  /* ——— C. каскад директора ——— */
  console.log('\n[C] директор');
  await page.evaluate(() => empSetDirector(true));
  await page.waitForTimeout(80);
  ok('директор включает ПМ', await page.evaluate(() => empPM === true && document.getElementById('e-pm').checked));
  ok('биллинг и документы включены', await page.evaluate(() => empPerms.billing.view === true && empPerms.documents.view === true));
  ok('полный доступ ко всем модулям', await page.evaluate(() => _permKeys().every(k => empPerms[k].view && (empPerms[k].edit || ['integrations', 'mail'].indexOf(k) >= 0 || empPerms[k].edit))));
  ok('нижний блок заблокирован', await page.evaluate(() => document.getElementById('e-access-sub').classList.contains('dir-locked')));
  ok('видно объяснение, а не только серость', await page.evaluate(() => document.getElementById('empw-lock').classList.contains('on')));
  ok('бейдж стал «Директор»', await page.evaluate(() => document.getElementById('empw-badge').textContent) === 'Директор');
  ok('проекты подменены баннером', await page.evaluate(() => /видит все проекты/.test(document.getElementById('e-prj-hint').textContent) && document.getElementById('e-prj-t-all').hasAttribute('disabled')));
  ok('в подвале «проекты: Все»', /проекты: <b>Все<\/b>/.test(await page.evaluate(() => document.getElementById('empw-sum').innerHTML)));
  await page.evaluate(() => empSetDirector(false));
  await page.waitForTimeout(80);
  ok('снятие директора разблокирует', await page.evaluate(() => !document.getElementById('e-access-sub').classList.contains('dir-locked') && !document.getElementById('empw-lock').classList.contains('on')));

  /* ——— D. ПМ отдельно ——— */
  console.log('\n[D] проектный менеджер');
  await page.evaluate(() => { empPM = false; document.getElementById('e-pm').checked = false; _renderPrjScope(); });
  await page.evaluate(() => { const c = document.getElementById('e-pm'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(80);
  /* Раньше ПМ обходил зону доступа наравне с директором, и выбор проектов
     ему подменялся баннером. У агентства бывает три ПМ на три направления,
     и каждому незачем видеть чужие: теперь набор задаётся, как у всех. */
  const PMS = await page.evaluate(() => ({
    banner: /видит все проекты/.test(document.getElementById('e-prj-hint').innerHTML),
    pickable: !document.getElementById('e-prj-t-all').hasAttribute('disabled')
      && !document.getElementById('e-prj-t-asg').hasAttribute('disabled'),
    scope: (typeof empProjectScope !== 'undefined') ? empProjectScope : null }));
  ok('у ПМ выбор проектов доступен, а не подменён баннером',
    PMS.pickable && !PMS.banner, PMS);
  ok('и по умолчанию он видит только назначенные', PMS.scope === 'assigned', PMS.scope);
  const PMD = await page.evaluate(() => {
    empSetDirector(true);
    const r = { banner: /видит все проекты/.test(document.getElementById('e-prj-hint').innerHTML),
      locked: document.getElementById('e-prj-t-all').hasAttribute('disabled') };
    empSetDirector(false); return r;
  });
  ok('а директору выбор по-прежнему не нужен: он видит всё агентство',
    PMD.banner && PMD.locked, PMD);
  ok('бейдж «Проектный менеджер»', await page.evaluate(() => document.getElementById('empw-badge').textContent) === 'Проектный менеджер');
  await page.evaluate(() => { const c = document.getElementById('e-pm'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(80);
  ok('после снятия список проектов вернулся', await page.evaluate(() => !document.getElementById('e-prj-t-all').hasAttribute('disabled')));

  /* ——— E. права ——— */
  console.log('\n[E] таблица прав');
  await page.evaluate(() => permPreset('none'));
  await page.waitForTimeout(60);
  ok('«Очистить» снимает всё', await page.evaluate(() => _permKeys().every(k => !empPerms[k].view)));
  const N = await page.evaluate(() => _permKeys().length);
  const FIN = await page.evaluate(() => !(typeof agModuleOff === 'function' && agModuleOff('finance')));
  ok('счётчик в навигации показывает ноль из всех ключей',
    await page.evaluate(() => document.getElementById('empw-c-perm').textContent) === '0/' + N, N);
  const groups = await page.evaluate(() => [...document.querySelectorAll('#e-perms .perm-gh')].map(e => e.textContent));
  ok('модули разбиты на группы', groups.join('|') === 'Работа|Аналитика|Агентство', groups);
  /* Модуль без строки в этой сетке выдать нельзя вообще: пункт меню скрывается
     по отсутствию права, а поставить право негде. Так «Эффективность контента»
     и была невидима для всех, кроме владельца и директора. */
  const ПОЛНЫЙ = ['projects','deadlines','calendar','overview','cycles','finance',
                  'team','kpi','leaderboard','content','calc','kb','tools','mail','integrations'];
  /* Сетка строится из _permKeys(), а незаписанные в группы ключи падают в
     «Ещё» — значит строка гарантирована каждому ключу списка. Проверяем список. */
  const К = await page.evaluate(() => ({ все: _permKeysAll() }));
  ok('в правах есть строка на каждый модуль кабинета',
      ПОЛНЫЙ.every(k => К.все.indexOf(k) >= 0) && К.все.length === ПОЛНЫЙ.length, К.все);
  ok('и «Эффективность контента» среди них', К.все.indexOf('content') >= 0, К.все);
  ok('строк ровно по числу ключей', await page.evaluate(() => document.querySelectorAll('#e-perms .perm-row:not(.perm-sub)').length === _permKeys().length));

  /* У финансов есть ступень, которой нет больше ни у кого: финансист ведёт
     счета и платежи, но кто из совладельцев сколько внёс и взял — не его дело.
     Раздел сейчас выключен целиком, и тогда права на него не выдают вовсе —
     проверяем именно это. Вернут раздел в строй — вернутся и проверки: они
     не удалены, а зависят от того же выключателя, что и сам раздел. */
  if (!FIN) {
    const NOFIN = await page.evaluate(() => ({
      вКлючах: _permKeys().indexOf('finance'),
      строка: [...document.querySelectorAll('#e-perms .perm-name')].some(e => /Финанс/.test(e.textContent)),
      подстрока: !!document.querySelector('#e-perms .perm-sub')
    }));
    ok('раздел выключен — права на него не выдают вовсе',
      NOFIN.вКлючах === -1 && NOFIN.строка === false, NOFIN);
    ok('и подстроки про расчёты с владельцами в таблице нет', NOFIN.подстрока === false, NOFIN);
  } else {
    const SUB = await page.evaluate(() => {
      const row = () => document.querySelector('#e-perms .perm-sub');
      const btn = () => row().querySelector('.perm-tg');
      const off = !!(empPerms.finance && empPerms.finance.partners);
      const locked = btn().hasAttribute('disabled');
      togglePerm('finance', 'partners', true);
      const auto = !!(empPerms.finance && empPerms.finance.view);
      togglePerm('finance', 'view', false);
      return { exists: !!row(), off, locked, auto, cleared: !!(empPerms.finance && empPerms.finance.partners),
        label: row().textContent };
    });
    ok('у финансов есть подстрока про расчёты с владельцами',
      SUB.exists && /Расчёты с владельцами/.test(SUB.label), SUB.label);
    ok('по умолчанию она снята и заперта, пока нет просмотра финансов',
      SUB.off === false && SUB.locked === true, SUB);
    ok('включение права само открывает просмотр финансов', SUB.auto === true, SUB.auto);
    ok('снятие просмотра финансов гасит и её', SUB.cleared === false, SUB.cleared);
  }
  await page.evaluate(() => permPreset('none'));
  ok('пресеты живут в шапке раздела, не в таблице', await page.evaluate(() => !document.querySelector('#e-perms .perm-presets') && document.querySelectorAll('#empw-s-perm .empw-preset').length === 3));
  ok('итог ушёл из таблицы в подвал окна', await page.evaluate(() => !document.querySelector('#e-perms .perm-foot') && !!document.getElementById('empw-sum')));
  await page.evaluate(() => permPreset('view'));
  await page.waitForTimeout(60);
  const sum1 = await page.evaluate(() => document.getElementById('empw-sum').textContent.replace(/\s+/g, ' '));
  ok('подвал: видит все ключи, редактирует ноль',
    new RegExp('Видит ' + N + ' из ' + N).test(sum1) && /редактирует 0/.test(sum1), sum1);
  /* Ступень «правка поднимает просмотр» — общая для всех модулей, поэтому
     берём любой живой ключ, а не тот, который могли выключить. */
  const K = await page.evaluate(() => _permKeys().filter(k => k !== 'mail' && k !== 'integrations')[0]);
  await page.evaluate(k => togglePerm(k, 'edit', true), K);
  await page.waitForTimeout(60);
  ok('правка поднимает просмотр', await page.evaluate(k => empPerms[k].view === true && empPerms[k].edit === true, K), K);
  await page.evaluate(k => togglePerm(k, 'view', false), K);
  await page.waitForTimeout(60);
  ok('снятие просмотра гасит правку', await page.evaluate(k => empPerms[k].view === false && empPerms[k].edit === false, K), K);
  ok('чипы предпросмотра показывают модули', await page.evaluate(() => document.querySelectorAll('#empw-prev-chips .empw-chip').length > 0));

  /* ——— F. проекты ——— */
  console.log('\n[F] доступ к проектам');
  await page.evaluate(() => { empSetProjectScope('assigned'); empSelAllProjects(false); });
  await page.waitForTimeout(80);
  ok('список проектов виден', await page.evaluate(() => document.querySelectorAll('#e-prj-list-host .prj-scope-item').length) === 10);
  ok('поиск появился при десяти проектах', await page.evaluate(() => document.getElementById('e-prj-q-row').classList.contains('on')));
  await page.evaluate(() => { empToggleProject('p0'); empToggleProject('p1'); empToggleProject('p2'); });
  await page.waitForTimeout(60);
  ok('счётчик в навигации показывает 3', await page.evaluate(() => document.getElementById('empw-c-prj').textContent) === '3');
  ok('подвал списка: выбрано 3 из 10', /Выбрано <b>3<\/b> из 10/.test(await page.evaluate(() => document.getElementById('e-prj-foot').innerHTML)));
  await page.fill('#e-prj-q', 'кофе');
  await page.waitForTimeout(80);
  ok('поиск сужает список', await page.evaluate(() => document.querySelectorAll('#e-prj-list-host .prj-scope-item').length) === 1);
  ok('но «из 10» не врёт', /из 10/.test(await page.evaluate(() => document.getElementById('e-prj-foot').innerHTML)));
  await page.fill('#e-prj-q', '');
  await page.waitForTimeout(80);
  await page.evaluate(() => empSetProjectScope('all'));
  await page.waitForTimeout(60);
  ok('режим «Все проекты» прячет список', await page.evaluate(() => document.getElementById('e-prj-list-host').style.display) === 'none');
  ok('и в навигации пишет «Все»', await page.evaluate(() => document.getElementById('empw-c-prj').textContent) === 'Все');
  await page.evaluate(() => empSetProjectScope('assigned'));

  /* ——— G. вход ——— */
  console.log('\n[G] вход в систему');
  await page.fill('#e-login', 'ivan');
  await page.waitForTimeout(60);
  ok('почта пересобирается на лету', await page.evaluate(() => document.getElementById('e-email').textContent) === 'ivan@detroyd.triada.app');
  ok('пароль по умолчанию скрыт', await page.evaluate(() => document.getElementById('e-pass').type) === 'password');
  await page.evaluate(() => empwPassGen());
  await page.waitForTimeout(60);
  const pw = await page.evaluate(() => document.getElementById('e-pass').value);
  ok('пароль из 12 знаков', pw.length === 12, pw);
  ok('в пароле есть регистр и цифра', /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /[2-9]/.test(pw), pw);
  ok('без похожих символов 0 O 1 l I', !/[0O1lI]/.test(pw), pw);
  ok('после генерации пароль видно', await page.evaluate(() => document.getElementById('e-pass').type) === 'text');
  await page.evaluate(() => empwPassEye());
  ok('глаз прячет обратно', await page.evaluate(() => document.getElementById('e-pass').type) === 'password');

  /* ——— H. валидация ——— */
  console.log('\n[H] валидация');
  await page.fill('#e-gmail', 'ivan@detroyd.triada.app');
  await page.evaluate(() => { window.__toasts = []; saveEmp(); });
  await page.waitForTimeout(400);
  ok('логин вместо почты Google не проходит', await page.evaluate(() => window.__toasts[0]) === 'Это логин в системе, а не почта Google — нужен настоящий адрес');
  ok('поле подсвечено ошибкой', await page.evaluate(() => document.getElementById('e-gmail').closest('.fld').classList.contains('err')));
  ok('окно осталось открытым', await page.evaluate(() => document.getElementById('ov-emp').classList.contains('on')));
  await page.fill('#e-gmail', 'ivan@gmail.com');
  await page.waitForTimeout(60);
  ok('ошибка гаснет при вводе', await page.evaluate(() => !document.getElementById('e-gmail').closest('.fld').classList.contains('err')));
  await page.fill('#e-name', '');
  await page.evaluate(() => { window.__toasts = []; saveEmp(); });
  await page.waitForTimeout(400);
  ok('пустое имя не проходит', await page.evaluate(() => window.__toasts[0]) === 'Введи имя сотрудника');
  ok('точка тревоги в навигации', await page.evaluate(() => document.getElementById('empw-c-prof').classList.contains('bad')));
  ok('увело к разделу «Профиль»', await page.evaluate(() => document.querySelector('#empw-nav .empw-nav-i.on').dataset.sec) === 'prof');
  await page.fill('#e-name', 'Иван Иванов');

  /* ——— I. навигация и скролл ——— */
  console.log('\n[I] навигация');
  /* Плавность проверяем глазами, а не секундомером: на время замеров геометрии
     выключаем анимацию, иначе тест меряет длину анимации, а не точку прокрутки. */
  await page.addStyleTag({ content: '#ov-emp .empw-body{scroll-behavior:auto!important}' });
  /* Подсветка пункта пересчитывается в requestAnimationFrame, а безголовый
     Chromium рисует кадры только по требованию: без принудительной прокачки
     обработчик иногда не успевал сработать, и тест падал через раз не из-за
     продукта, а из-за отсутствия кадра. */
  const frames = async (n = 4) => { for (let i = 0; i < n; i++) await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
  const settle = async () => { await page.waitForTimeout(150); await frames(); };
  await page.evaluate(() => { document.getElementById('empw-body').scrollTop = 0; empwGo('prj'); });
  await settle();
  ok('клик по пункту ставит раздел под шапку', await page.evaluate(() => {
    const b = document.getElementById('empw-body'), s = document.getElementById('empw-s-prj');
    return Math.abs(s.getBoundingClientRect().top - b.getBoundingClientRect().top - 8) < 24;
  }), await page.evaluate(() => {
    const b = document.getElementById('empw-body'), s = document.getElementById('empw-s-prj');
    return s.getBoundingClientRect().top - b.getBoundingClientRect().top;
  }));
  ok('активный пункт — «Проекты»', await page.evaluate(() => document.querySelector('#empw-nav .empw-nav-i.on').dataset.sec) === 'prj');
  await page.evaluate(() => empwGo('login'));
  await settle();
  ok('последний раздел виден целиком', await page.evaluate(() => {
    const b = document.getElementById('empw-body').getBoundingClientRect(), s = document.getElementById('empw-s-login').getBoundingClientRect();
    return s.bottom <= b.bottom + 2 && s.top >= b.top - 2;
  }));
  ok('и пункт «Вход» загорелся', await page.evaluate(() => document.querySelector('#empw-nav .empw-nav-i.on').dataset.sec) === 'login');
  await page.evaluate(() => { document.getElementById('empw-body').scrollTo({ top: 0, behavior: 'auto' }); });
  await page.waitForTimeout(400);
  await frames(6);
  ok('прокрутка наверх возвращает подсветку на «Профиль»', await page.evaluate(() => document.querySelector('#empw-nav .empw-nav-i.on').dataset.sec) === 'prof');
  /* Единственная прокрутка в потоке — тело окна. Список проектов ограничен
     по высоте намеренно: это замкнутый блок, а не второй поток страницы. */
  const scrollers = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#ov-emp *').forEach(el => {
      if (el.scrollHeight - el.clientHeight > 4 && /auto|scroll/.test(getComputedStyle(el).overflowY)) out.push(el.id || String(el.className));
    });
    return out;
  });
  ok('по вертикали скроллится только тело окна', scrollers.filter(s => s !== 'empw-body' && !/prj-scope-list/.test(s)).length === 0, scrollers);
  ok('список проектов ограничен по высоте', await page.evaluate(() => {
    const l = document.querySelector('#e-prj-list-host .prj-scope-list');
    return !l || l.clientHeight <= 250;
  }));
  /* Три липкие полосы (заголовок раздела + шапка таблицы + заголовок группы)
     складывались стопкой, и строки пролезали между ними наполовину. */
  const sticky = await page.evaluate(() => [...document.querySelectorAll('#empw-body *')]
    .filter(el => getComputedStyle(el).position === 'sticky')
    .map(el => String(el.className)));
  ok('в прокручиваемой области липкая только шапка таблицы', sticky.length === 1 && /perm-head/.test(sticky[0]), sticky);
  ok('заголовок раздела едет вместе с содержимым', await page.evaluate(() =>
    getComputedStyle(document.querySelector('#empw-s-perm .empw-sec-h')).position) === 'static');
  await page.evaluate(() => { const b = document.getElementById('empw-body'), g = [...document.querySelectorAll('#e-perms .perm-gh')].pop();
    b.scrollTop = b.scrollTop + (g.getBoundingClientRect().top - b.getBoundingClientRect().top) - 70; });
  await page.waitForTimeout(200);
  ok('под шапкой таблицы ничего не копится', await page.evaluate(() => {
    const h = document.querySelector('#e-perms .perm-head').getBoundingClientRect();
    const g = [...document.querySelectorAll('#e-perms .perm-gh')].pop().getBoundingClientRect();
    /* заголовок группы отъехал от шапки и виден целиком, а не выглядывает из-под неё */
    return g.top >= h.bottom - 1 && g.height > 20;
  }));
  ok('шапка и подвал на месте при любом скролле', await page.evaluate(() => {
    const m = document.querySelector('#ov-emp .modal.empw').getBoundingClientRect();
    const t = document.querySelector('#ov-emp .empw-top').getBoundingClientRect();
    const f = document.querySelector('#ov-emp .empw-foot').getBoundingClientRect();
    return Math.abs(t.top - m.top) < 2 && Math.abs(f.bottom - m.bottom) < 2;
  }));

  /* ——— J. закрытие с изменениями ——— */
  console.log('\n[J] закрытие');
  await page.evaluate(() => empwTryClose());
  await page.waitForTimeout(80);
  ok('спрашивает про несохранённое', await page.evaluate(() => document.getElementById('ov-empclose').classList.contains('on')));
  ok('и окно ещё открыто', await page.evaluate(() => document.getElementById('ov-emp').classList.contains('on')));
  ok('вопрос виден поверх карточки', await page.evaluate(() => {
    const r = document.querySelector('#ov-empclose .modal').getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!(el && el.closest('#ov-empclose'));
  }));
  await page.evaluate(() => empwCloseAsk(0));
  ok('«Вернуться» возвращает', await page.evaluate(() => !document.getElementById('ov-empclose').classList.contains('on') && document.getElementById('ov-emp').classList.contains('on')));
  await page.evaluate(() => empwCloseAsk(1));
  await page.waitForTimeout(80);
  ok('«Закрыть» закрывает', await page.evaluate(() => !document.getElementById('ov-emp').classList.contains('on')));
  await page.evaluate(() => openEmp());
  await page.waitForTimeout(120);
  await page.evaluate(() => empwTryClose());
  await page.waitForTimeout(80);
  ok('нетронутую форму закрывает сразу', await page.evaluate(() => !document.getElementById('ov-emp').classList.contains('on') && !document.getElementById('ov-empclose').classList.contains('on')));

  /* ——— K. режим редактирования ——— */
  console.log('\n[K] редактирование');
  await page.evaluate(() => openEmpEdit(0));
  await page.waitForTimeout(300);
  ok('заголовок «Редактировать сотрудника»', await page.evaluate(() => document.getElementById('emp-title').textContent.trim()) === 'Редактировать сотрудника');
  ok('кнопка «Сохранить изменения»', await page.evaluate(() => document.getElementById('emp-save').textContent.trim()) === 'Сохранить изменения');
  ok('«Удалить сотрудника» видна', await page.evaluate(() => document.getElementById('emp-del').style.display) === '');
  ok('поля заполнены из карточки', await page.evaluate(() => document.getElementById('e-name').value) === 'Пётр Смирнов');
  ok('логин только для чтения', await page.evaluate(() => document.getElementById('e-login').readOnly === true));
  ok('и об этом написано', await page.evaluate(() => document.getElementById('e-login-note').style.display) === '');
  ok('пароль пуст', await page.evaluate(() => document.getElementById('e-pass').value) === '');
  ok('и сказано, что менять не обязательно', /Оставьте пустым/.test(await page.evaluate(() => document.getElementById('e-pass-hint').textContent)));
  ok('шапка показывает того, кого правим', await page.evaluate(() => document.getElementById('empw-card-nm').textContent) === 'Пётр Смирнов');

  /* ——— L. адаптив ——— */
  console.log('\n[L] раскладка на разных экранах');
  for (const vp of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(vp);
    await page.waitForTimeout(220);
    const r = await page.evaluate(() => {
      const m = document.querySelector('#ov-emp .modal.empw');
      const save = document.getElementById('emp-save').getBoundingClientRect();
      const body = document.getElementById('empw-body');
      return {
        hscroll: m.scrollWidth - m.clientWidth,
        fits: m.getBoundingClientRect().width <= innerWidth + 1 && m.getBoundingClientRect().height <= innerHeight + 1,
        saveVisible: save.top >= 0 && save.bottom <= innerHeight + 1 && save.width > 0,
        bodyScrolls: getComputedStyle(body).overflowY,
        /* шапка → навигация → тело → подвал: ряды сетки должны идти подряд,
           без наложений (мобильный bottom-sheet когда-то вставлял свой ::before
           лишней строкой и всё съезжало) */
        gaps: (() => {
          const r = ['.empw-top', '#empw-nav', '#empw-body', '.empw-foot']
            .map(s => (document.querySelector('#ov-emp ' + s) || {}).getBoundingClientRect
              ? document.querySelector('#ov-emp ' + s).getBoundingClientRect() : null).filter(Boolean);
          const out = []; for (let i = 1; i < r.length; i++) out.push(Math.round(r[i].top - r[i - 1].bottom));
          return out;
        })(),
      };
    });
    ok(vp.width + '×' + vp.height + ': нет горизонтального скролла', r.hscroll <= 1, r);
    ok(vp.width + '×' + vp.height + ': окно помещается', r.fits, r);
    ok(vp.width + '×' + vp.height + ': кнопка сохранения видна', r.saveVisible, r);
    /* Вертикальной лентой ряды идут только на узких экранах; шире 900
       навигация стоит слева, и сравнивать её низ с верхом тела нечего. */
    if (vp.width <= 900) ok(vp.width + '×' + vp.height + ': блоки окна не наезжают друг на друга', r.gaps.every(g => g >= -1), r.gaps);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(150);

  /* ——— M. соседние экраны не тронуты ——— */
  console.log('\n[M] чужая вёрстка');
  await page.evaluate(() => closeEmp());
  const other = await page.evaluate(() => {
    const el = document.createElement('div');
    el.innerHTML = '<div class="modal" id="__probe_modal"><div class="modal-h"><h3>x</h3></div><div class="modal-f"><button class="btn-add">ok</button></div></div>';
    document.body.appendChild(el);
    const m = document.getElementById('__probe_modal');
    const cs = getComputedStyle(m);
    const r = { maxWidth: cs.maxWidth, radius: cs.borderRadius, display: cs.display };
    el.remove(); return r;
  });
  ok('обычная .modal осталась прежней', other.maxWidth === '460px' && other.radius === '14px' && other.display === 'block', other);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read|TypeError/.test(e));
  console.log('\n[N] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
