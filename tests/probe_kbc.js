/* probe_kbc — контакты проекта в базе знаний: видно, кто со стороны клиента,
   а кто с нашей; локация — карточка, а не сырой JSON; проект-менеджер не
   дублируется в команде, а «не указан» не притворяется контактом. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.toast = () => {}; window.LIVE = true;
  window.SB = { from: function () { return { select: function () { return { eq: function () { return { order: function () { return Promise.resolve({ data: [], error: null }); } }; } }; } }; } };
  window.tMe = () => ({ id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' });
  window.ME = window.tMe(); window.agIsOwner = () => true; window.agCanView = () => true; window.agCanEdit = () => true;
  PROJECTS = [{ id: 'p1', name: 'Qushbegi Milliy Taomlar', logo: 'Q', logoUrl: null, status: 'active', _tasks: [], _stages: [],
    contacts: {
      person: { name: 'Анвар', role: 'Директор', phone: '+998903714445', tg: 'не указан' },
      place: { url: 'https://maps.google.com/maps?q=41.267841,69.245895&ll=41.267841,69.245895&z=16', name: 'Qushbegi Milliy Taomlar' },
      channels: { telegram: 'https://t.me/qushbegi', instagram: 'https://instagram.com/qushbegi.uz', youtube: '' },
      warehouse: { city: 'Ташкент', street: 'Chimrobod 1' } } }];
  window.PROJECTS = PROJECTS;
  KB_PROJECTS.length = 0;
  KB_PROJECTS.push({ id: 'p1', key: 'p1', name: 'Qushbegi Milliy Taomlar', st: 'active', logo: 'Q' });
  kbProj = 'p1';
  kbAutoEnsure = function () {};
  KB_AUTO['p1'] = { _loaded: true, services: [], contract: null, client: null,
    _full: { briefs: [], briefAt: '' },
    lead: { id: 'm1', full_name: 'Abdurauf Parpiyev', role_title: 'Арт директор', phone: '+998993323312', tg_username: '@parpiyevxon' },
    members: [{ role_in_project: 'Арт директор', prof: { id: 'm1', full_name: 'Abdurauf Parpiyev', role_title: 'Арт директор', phone: '+998993323312', tg_username: '@parpiyevxon' } },
              { role_in_project: 'Монтаж', prof: { id: 'm2', full_name: 'Nurislam Aliyev', role_title: 'CEO', phone: '+998950503655', tg_username: 'DeTroyd_System_Group' } },
              { role_in_project: '', prof: { id: 'm3', full_name: 'Мадина', role_title: '', phone: '', tg_username: '' } }] };
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
  await page.evaluate(setup);
  await page.waitForTimeout(800);

  const S = () => page.evaluate(() => {
    const s = document.getElementById('kbs-cont');
    const cards = [...s.querySelectorAll('.kb-ccard')].map(c => ({
      nm: (c.querySelector('.kb-ccard-nm') || {}).childNodes ? c.querySelector('.kb-ccard-nm').childNodes[0].textContent.trim() : '',
      badge: (c.querySelector('.kb-ccard-b') || {}).textContent || '',
      role: (c.querySelector('.kb-ccard-role') || {}).textContent || '',
      chips: [...c.querySelectorAll('.kb-chip')].map(x => x.textContent.replace(/\s+/g, ' ').trim()),
      no: !!c.querySelector('.kb-ccard-no') }));
    const sides = [...s.querySelectorAll('.kb-side')].map(e => ({ t: e.querySelector('.t').textContent, s: (e.querySelector('.s') || {}).textContent || '',
      idx: [...s.querySelectorAll('*')].indexOf(e) }));
    return { sides, cards, txt: s.textContent, cnt: (s.querySelector('.ct') || {}).textContent,
      subs: [...s.querySelectorAll('.kb-sub-h')].map(e => e.textContent.trim()),
      kv: [...s.querySelectorAll('.kb-kv')].map(e => e.textContent.replace(/\s+/g, ' ').trim()) };
  });
  const d = await S();

  console.log('\n[A] стороны названы своими именами');
  ok('в разделе две стороны', d.sides.length === 2, d.sides);
  ok('сначала клиент, потом мы', d.sides.map(x => x.t).join(' → ') === 'Клиент → Агентство', d.sides);
  ok('и подписано, кто есть кто', /их стороны/.test(d.sides[0].s) && /нашей стороны/.test(d.sides[1].s), d.sides);

  console.log('\n[B] клиент');
  const anvar = d.cards.find(c => /Анвар/.test(c.nm));
  ok('контактное лицо на месте', !!anvar && /Директор/.test(anvar.role), anvar);
  ok('пустой телеграм не притворяется контактом',
    !!anvar && anvar.chips.length === 1 && /\+998903714445/.test(anvar.chips[0]), anvar);
  ok('«не указан» не встречается нигде в разделе', !/не указан/i.test(d.txt), d.txt.slice(0, 120));
  ok('каналы клиента остались отдельным блоком', d.subs.indexOf('Каналы клиента') >= 0, d.subs);

  console.log('\n[C] локация вместо сырого JSON');
  const place = d.cards.find(c => /Локация клиента/.test(c.role));
  ok('локация показана карточкой', !!place && /Qushbegi/.test(place.nm), place);
  ok('в ней ссылка на карту', !!place && place.chips.some(c => /maps\.google\.com/.test(c)), place);
  ok('и название для копирования', !!place && place.chips.some(c => /Qushbegi Milliy Taomlar/.test(c)), place);
  ok('JSON на экран больше не попадает', !/\{"url"|"name":|\}\s*$/.test(d.txt.trim()) && d.txt.indexOf('{"') < 0, d.txt.slice(-160));

  console.log('\n[D] агентство');
  const lead = d.cards.filter(c => /Abdurauf/.test(c.nm));
  ok('проект-менеджер один, а не двое', lead.length === 1, d.cards.map(c => c.nm));
  ok('и помечен, что ведёт проект', lead[0] && lead[0].badge === 'ведёт проект', lead);
  ok('остальная команда на месте', d.cards.some(c => /Nurislam/.test(c.nm)) && d.cards.some(c => /Мадина/.test(c.nm)), d.cards.map(c => c.nm));
  ok('роль в проекте показана, когда отличается от должности',
    (d.cards.find(c => /Nurislam/.test(c.nm)) || {}).badge === 'Монтаж', d.cards.find(c => /Nurislam/.test(c.nm)));
  ok('у кого нет телефона — так и написано', (d.cards.find(c => /Мадина/.test(c.nm)) || {}).no === true, d.cards.find(c => /Мадина/.test(c.nm)));

  console.log('\n[E] счётчик и прочие поля');
  /* Анвар + проект-менеджер + двое из команды. Локация — не человек и в
     счётчик не идёт, дубль менеджера — тем более. */
  const people = d.cards.filter(c => !/Локация/.test(c.role)).length;
  ok('счётчик считает живых людей, а не карточки', d.cnt === String(people) && people === 4, { cnt: d.cnt, people: people });
  ok('незнакомое поле разложено по-человечески',
    d.kv.some(x => /warehouse/.test(x) && /city: Ташкент/.test(x) && /street: Chimrobod 1/.test(x)), d.kv);

  console.log('\n[F] пустые данные не ломают раздел');
  const empty = await page.evaluate(() => {
    PROJECTS[0].contacts = { person: { name: '', role: '', phone: '', tg: '' }, place: { url: '', name: '' }, channels: {} };
    KB_AUTO['p1'].lead = null; KB_AUTO['p1'].members = [];
    renderKB();
    const s = document.getElementById('kbs-cont');
    return { txt: s.textContent.replace(/\s+/g, ' ').trim(), cards: s.querySelectorAll('.kb-ccard').length, sides: s.querySelectorAll('.kb-side').length };
  });
  ok('пустой раздел говорит об этом прямо', /Нет контактов/.test(empty.txt) && empty.cards === 0, empty);
  ok('и не рисует пустые стороны', empty.sides === 0, empty);

  ok('страница без ошибок', errs.length === 0, errs.slice(0, 2));
  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
