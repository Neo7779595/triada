/* probe_ctloc — локация клиента на Яндекс.Картах: достаточно названия,
   ссылка принимается любая, карта и подпись строятся из того, что есть,
   и сохраняются в контакты проекта. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = (place) => {
  window.__t = ''; window.toast = t => { window.__t = String(t); };
  window.LIVE = false;
  window.__upd = [];
  window.SB = { from(t) { return { update(patch) { return { eq(col, val) { window.__upd.push({ t, patch, col, val }); return Promise.resolve({ error: null }); } }; } }; } };
  window.tMe = () => ({ id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' });
  window.ME = window.tMe(); window.TEAM = [];
  window.agIsOwner = () => true; window.agCanEditProject = () => true; window.agIsPM = () => true;
  window.giEnsureStatus = async () => ({ status: 'inactive' });
  window.tLoadProjectWork = null; window.tLoadProjectToday = null;
  PROJECTS = [{ id: 'p1', name: 'Qushbegi Milliy Taomlar', status: 'active', _stages: [], _tasks: [], _appr: [], _reports: [],
    contacts: { person: { name: 'Анвар', role: 'Директор', phone: '+998903714445', tg: '' },
      place: place, channels: { instagram: '@qushbegi.uz', telegram: '', youtube: '', other: [] } } }];
  window.PROJECTS = PROJECTS;
  openProject(0);
  contactsOpen();
};

const read = () => {
  const q = s => document.querySelector(s);
  const row = q('.ct-place .ct-place-row');
  return {
    has: !!q('.ct-place'),
    secs: [...document.querySelectorAll('.ct-sec-h')].map(e => e.textContent.replace('Изменить', '').trim()),
    map: q('.ct-map iframe') ? q('.ct-map iframe').getAttribute('src') : null,
    lazy: q('.ct-map iframe') ? q('.ct-map iframe').getAttribute('loading') : null,
    title: q('.ct-place .ct-row-v') ? q('.ct-place .ct-row-v').textContent : null,
    tag: row ? row.tagName : null,
    href: row ? row.getAttribute('href') : null,
    blank: row ? row.getAttribute('target') : null,
    copy: q('.ct-place .ct-copy') ? q('.ct-place .ct-copy').dataset.v : null,
    empty: (document.body.textContent.indexOf('Локация не указана') >= 0),
  };
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  console.log('\n[A] одного названия достаточно');
  await page.evaluate(setup, { name: 'Qushbegi Milliy Taomlar, Ташкент', url: '' });
  await page.waitForTimeout(250);
  const byName = await page.evaluate(read);
  ok('блок локации стоит между лицом и каналами',
    byName.secs.join(' | ') === 'Контактное лицо | Локация | Активные каналы продвижения', byName.secs);
  ok('карта строится поиском по названию', /map-widget\/v1\/\?/.test(byName.map || '') && /text=Qushbegi%20Milliy/.test(byName.map || ''), byName.map);
  ok('карта грузится лениво — модалка открывается сразу', byName.lazy === 'lazy', byName.lazy);
  ok('подпись — само название', byName.title === 'Qushbegi Milliy Taomlar, Ташкент', byName.title);
  ok('строка ведёт в Яндекс.Карты', byName.tag === 'A' && /yandex\.[a-z]+\/maps\/\?text=/.test(byName.href || ''), byName);
  ok('открывается в новой вкладке', byName.blank === '_blank', byName.blank);
  ok('копируется название, а не служебная ссылка', byName.copy === 'Qushbegi Milliy Taomlar, Ташкент', byName.copy);

  console.log('\n[B] ссылка с координатами ставит точную метку');
  await page.evaluate(setup, { name: '', url: 'https://yandex.uz/maps/10335/tashkent/?ll=69.240562%2C41.311081&z=17' });
  await page.waitForTimeout(250);
  const byLL = await page.evaluate(read);
  ok('в карту ушли координаты из ссылки', /ll=69\.240562%2C41\.311081/.test(byLL.map || ''), byLL.map);
  ok('масштаб взят из ссылки', /[?&]z=17/.test(byLL.map || ''), byLL.map);
  ok('на карте стоит метка', /pt=69\.240562%2C41\.311081,pm2rdm/.test(byLL.map || ''), byLL.map);
  ok('ссылка открывается как есть', byLL.href === 'https://yandex.uz/maps/10335/tashkent/?ll=69.240562%2C41.311081&z=17', byLL.href);

  console.log('\n[C] ссылка на организацию — подпись из адреса');
  await page.evaluate(setup, { name: '', url: 'https://yandex.uz/maps/org/qushbegi_milliy_taomlar/1234567890/' });
  await page.waitForTimeout(250);
  const byOrg = await page.evaluate(read);
  ok('подпись собрана из адреса организации', byOrg.title === 'qushbegi milliy taomlar', byOrg.title);
  ok('карта ищет это же название', /text=qushbegi%20milliy%20taomlar/.test(byOrg.map || ''), byOrg.map);

  console.log('\n[D] ссылка без схемы и пустая локация');
  const noScheme = await page.evaluate(() => ({ link: _ctYaLink('', 'yandex.uz/maps/org/x/1/'), byName: _ctYaLink('Кафе «Плов»', ''),
    nothing: _ctYaLink('', ''), emb: _ctYaEmbed('', ''), broken: _ctYaEmbed('', 'не ссылка вовсе') }));
  ok('к адресу без схемы подставляется https', noScheme.link === 'https://yandex.uz/maps/org/x/1/', noScheme.link);
  ok('название превращается в поисковый запрос', /maps\/\?text=/.test(noScheme.byName), noScheme.byName);
  ok('пусто на входе — пусто на выходе', noScheme.nothing === '' && noScheme.emb === '', noScheme);
  ok('мусор вместо ссылки не роняет карту', typeof noScheme.broken === 'string', noScheme.broken);

  await page.evaluate(setup, { name: '', url: '' });
  await page.waitForTimeout(250);
  const none = await page.evaluate(read);
  ok('без локации раздел есть, но пустой', !none.has && none.empty, none);

  console.log('\n[E] форма правки и сохранение');
  await page.evaluate(setup, { name: 'Старое место', url: '' });
  await page.waitForTimeout(200);
  await page.evaluate(() => contactsEdit());
  await page.waitForTimeout(250);
  const form = await page.evaluate(() => ({
    name: document.getElementById('ct-place-name') ? document.getElementById('ct-place-name').value : null,
    url: document.getElementById('ct-place-url') ? document.getElementById('ct-place-url').value : null,
    hint: (document.querySelector('.ct-hint') || {}).textContent || '',
    secs: [...document.querySelectorAll('.ct-sec-h')].map(e => e.textContent.trim()),
  }));
  ok('поле названия заполнено текущим значением', form.name === 'Старое место', form.name);
  ok('поле ссылки есть и пустое', form.url === '', form.url);
  ok('подсказка объясняет оба способа', /Достаточно названия/.test(form.hint) && /ссылк/i.test(form.hint), form.hint);
  ok('раздел локации в форме назван', form.secs.some(t => /Локация/.test(t)), form.secs);

  const saved = await page.evaluate(async () => {
    document.getElementById('ct-place-name').value = 'Новое место';
    document.getElementById('ct-place-url').value = 'https://yandex.uz/maps/?ll=1%2C2&z=15';
    await contactsSave();
    return { upd: window.__upd, place: PROJECTS[0].contacts.place, person: PROJECTS[0].contacts.person.name,
      map: (document.querySelector('.ct-map iframe') || {}).src || null, toast: window.__t };
  });
  ok('локация ушла в базу вместе с контактами', saved.upd.length === 1 && saved.upd[0].t === 'projects'
    && saved.upd[0].patch.contacts.place.name === 'Новое место', saved.upd);
  ok('ссылка сохранена рядом с названием', saved.place.url === 'https://yandex.uz/maps/?ll=1%2C2&z=15', saved.place);
  ok('остальные контакты не пострадали', saved.person === 'Анвар', saved.person);
  ok('после сохранения карта перерисована по новой ссылке', /ll=1%2C2/.test(saved.map || ''), saved.map);
  ok('пользователю сказали, что сохранили', /сохранен/i.test(saved.toast || ''), saved.toast);

  ok('страница без ошибок', errs.length === 0, errs.slice(0, 2));
  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
