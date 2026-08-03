/* probe_kbnav — досье в базе знаний: витрина, блоки, лента переходов.

   Раньше правая колонка была одной лентой из восьми разделов: оглавление
   сверху уезжало при прокрутке, пустой раздел занимал столько же места,
   сколько полный, а материалы лежали ниже всего остального. Теперь у
   досье два состояния — витрина из плиток и один открытый блок.

   Числа в проверках посчитаны по фикстуре ниже, а не сняты с экрана:
   10 блоков (6 «проект» + 4 «за период»), 3 человека, 2 материала,
   2 отчёта, 1 контент-план, 51 день до конца договора. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'detroyd', role: 'agency_owner', agency_id: 'AG', agencySlug: 'probe' };
  window.tMe = () => window.__me; window.ME = window.__me;
  window.toast = () => {}; window.LIVE = true; window.SB = window.SB || { from: () => ({}) };
  window.agIsOwner = () => true; window.agCanView = () => true; window.agCanEdit = () => true;
  window.agCanSeeProject = () => true;
  kbAutoEnsure = function () {};                    /* иначе сводка пойдёт в базу и упрётся в заглушку */
  const day = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  /* Лицо и марка нарисованы прямо здесь: важно не что на картинке, а что
     она встаёт на место буквы. */
  const FACE = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#2E3B4E"/><circle cx="32" cy="25" r="11" fill="#E8C9A8"/></svg>');
  const LOGO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#12281f"/><circle cx="24" cy="20" r="9" fill="#37E6C8"/></svg>');
  const P1 = { id: 'p1', key: 'p1', name: 'APOLO COFFEE', logo: 'A', logoUrl: LOGO, st: 'active',
    svc: 'PROD', cat: 'IT компания', tariff: 'DeGold', status: 'active', pct: 25, stages: '2/8',
    mrr: 45000000, note: 'Клиент просит больше вертикального видео.', createdAt: '2026-06-15',
    tg_chat_id: -1001234567890, tg_settings: {},
    contacts: { person: { name: 'Шохрух Каримов', role: 'Директор', phone: '+998901234567', tg: '@shohruh' } } };
  /* Второй проект пустой — на нём видно, как выглядит блок без содержимого. */
  const P2 = { id: 'p2', key: 'p2', name: 'Artel', logo: 'A', st: 'active', status: 'active', pct: 0, stages: '0/5' };
  /* Ещё два проекта — чтобы бенчмарку было с чем сравнивать: меньше трёх
     он не показывается намеренно. Прогресс: 25, 0, 70, 48 → медиана 36,5,
     у нашего 25 — третье место из четырёх. */
  const P3 = { id: 'p3', key: 'p3', name: 'Level Studio', logo: 'L', st: 'active', status: 'active', pct: 70, stages: '7/10' };
  const P4 = { id: 'p4', key: 'p4', name: 'DeTroyd', logo: 'D', st: 'active', status: 'active', pct: 48, stages: '4/8' };
  PROJECTS.length = 0; PROJECTS.push(P1, P2, P3, P4);
  window.agVisibleProjects = () => PROJECTS;
  KB_PROJECTS.length = 0; KB_PROJECTS.push(P1, P2, P3, P4);
  KB_PORT = { _loading: 0, _loaded: 1, _at: Date.now(), _err: '', rows: {
    p1: { rep: [new Date().toISOString(), new Date().toISOString()], smm: [new Date().toISOString()], plan: [new Date().toISOString()], ctEnd: day(51) },
    p2: { rep: [], smm: [], plan: [], ctEnd: '' },
    p3: { rep: [new Date().toISOString()], smm: [], plan: [new Date().toISOString(), new Date().toISOString()], ctEnd: day(120) },
    p4: { rep: [new Date().toISOString(), new Date().toISOString(), new Date().toISOString()], smm: [], plan: [], ctEnd: day(20) } } };
  window.kbPortEnsure = () => {};
  kbProj = 'p1';
  KB_DATA['p1'] = { 'Контент-стратегия': [
    { t: 'Контент-стратегия · осень', ty: 'Miro', url: 'https://miro.com/x', at: day(-6), _id: 'm1' },
    { t: 'Рубрикатор', ty: 'Google Doc', url: '', at: day(-12), _id: 'm2' } ] };
  KB_AUTO['p1'] = { _loaded: 1, _at: Date.now(),
    contract: { start_date: day(-9), end_date: day(51) },
    services: [{ service: 'PROD', tariff: 'DeGold', mrr: 25000000, status: 'active' }],
    members: [{ role_in_project: 'Оператор', prof: { id: 'm2', full_name: 'Худойберди', role_title: 'Оператор', phone: '', tg_username: '@h', avatar_url: FACE } }],
    lead: { id: 'm1', full_name: 'DTR Hunter', role_title: 'Проект-менеджер', phone: '+998907770011', tg_username: '@dtr', avatar_url: FACE },
    client: null,
    content: [{ id: 'c1', data: { sheets: [{ rows: [] }] }, updated_at: new Date().toISOString() }],
    reports: [{ id: 'r1', title: 'SMM-отчёт · август', kind: 'SMM', published_at: new Date().toISOString(), payload: { metrics: {} } },
              { id: 'r2', title: 'Performance', kind: 'PERF', published_at: new Date().toISOString(), payload: {} }],
    tasks: [{ status: 'done', time_spent: 3600, completed_at: new Date().toISOString() }],
    stages: [{ status: 'done', completed_at: new Date().toISOString() }],
    briefs: [], briefAt: '' };
  KB_AUTO['p2'] = { _loaded: 1, _at: Date.now(), contract: null, services: [], members: [], lead: null,
    client: null, content: [], reports: [], tasks: [], stages: [], briefs: [], briefAt: '' };
  document.querySelectorAll('.app').forEach(a => a.classList.remove('on'));
  document.getElementById('app-ag').classList.add('on');
  KB_BLOCK = '';
  renderKB();
};

const tiles = () => [...document.querySelectorAll('#content-ag .kb-tile')].map(t => ({
  n: t.querySelector('.tn').textContent,
  v: ((t.querySelector('.big') || t.querySelector('.note') || {}).textContent || '').trim(),
  mut: t.classList.contains('mut') }));
const strip = () => [...document.querySelectorAll('#content-ag .kb-si')].map(e => ({
  n: e.textContent.replace(/\d+$/, '').trim(),
  c: ((e.querySelector('b') || {}).textContent || ''),
  on: e.classList.contains('on'), mut: e.classList.contains('mut') }));
const head = () => ({ crumb: (document.querySelector('#content-ag .kb-bhd .cr') || {}).textContent,
  t: (document.querySelector('#content-ag .kb-bhd .t') || {}).textContent,
  back: !!document.querySelector('#content-ag .kb-back'),
  per: !!document.querySelector('#content-ag .kb-bhd .kb-per') });

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1400, height: 950 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 140)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);
  await page.evaluate(setup);
  await page.waitForTimeout(300);

  console.log('\n[A] досье открывается витриной, а не лентой разделов');
  const A2 = await page.evaluate(`(${tiles.toString()})()`);
  const heads = await page.evaluate(() => [...document.querySelectorAll('#content-ag .kb-sub-h')].map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  const stripN = await page.evaluate(() => document.querySelectorAll('#content-ag .kb-si').length);
  console.log('    ' + JSON.stringify(A2.map(t => t.n + '=' + t.v)));
  ok('на витрине ровно десять блоков', A2.length === 10, A2.length);
  /* Над плитками с недавних пор живёт «Что видно» — наблюдения. Группы
     ищем по названию, а не по номеру: иначе проверка ломается от любого
     нового блока над витриной, ничего не сказав о самих группах. */
  const grp = heads.filter(h => /Проект · вне периода/.test(h) || /^За /.test(h));
  ok('они разведены на «проект» и «за период»',
    /Проект · вне периода/.test(grp[0] || '') && /^За /.test(grp[1] || ''), grp);
  ok('в подписи нижней группы сказано, что фильтр меняет только её',
    /фильтр меняет эти четыре/.test(grp[1] || ''), grp[1]);
  ok('пока открыта витрина, ленты блоков нет — переключать нечего', stripN === 0, stripN);

  /* Три управления в шапке пришли из разных мест и выглядели как три
     разные детали: «Обновить» ростом 23 и пилюлей, период — 30, кнопка —
     30, и все три на разной высоте. Проверяем не пиксели, а равенство. */
  const bar = await page.evaluate(() => {
    const c = document.getElementById('content-ag');
    const box = e => { const b = e.getBoundingClientRect(), s = getComputedStyle(e);
      return { h: Math.round(b.height), mid: Math.round((b.top + b.bottom) / 2), r: s.borderRadius }; };
    const els = [c.querySelector('.kb-bhd .kb-per-pick'), c.querySelector('.kb-bhd .kb-refresh'),
                 c.querySelector('.kb-bhd .kb-act')].filter(Boolean);
    return { n: els.length, box: els.map(box) };
  });
  ok('в шапке досье все три управления на месте', bar.n === 3, bar);
  ok('у них одинаковый рост', new Set(bar.box.map(b => b.h)).size === 1, bar.box);
  ok('одинаковое скругление', new Set(bar.box.map(b => b.r)).size === 1, bar.box);
  ok('и они стоят ровно на одной линии', new Set(bar.box.map(b => b.mid)).size === 1, bar.box);

  console.log('\n[B] плитка показывает главное число своего блока');
  const byName = n => (A2.find(t => t.n === n) || {}).v;
  ok('«Контакты» — три человека', byName('Контакты') === '3человека', byName('Контакты'));
  ok('«Договор» — 51 день до конца', byName('Договор') === '51день', byName('Договор'));
  ok('«Материалы» — два', byName('Материалы') === '2материала', byName('Материалы'));
  ok('«Отчёты» — два', byName('Отчёты') === '2отчёта', byName('Отчёты'));
  ok('«Заметка» показывает саму заметку, а не число',
    /вертикального видео/.test(byName('Заметка') || ''), byName('Заметка'));

  console.log('\n[C] плитка открывает свой блок');
  const rep = await page.evaluate(`(()=>{ kbOpenBlock('rep'); return (${head.toString()})(); })()`);
  const repStrip = await page.evaluate(`(${strip.toString()})()`);
  console.log('    ' + JSON.stringify(rep));
  ok('в шапке — название блока, а над ним проект', rep.t === 'Отчёты' && rep.crumb === 'APOLO COFFEE', rep);
  ok('появилась стрелка назад', rep.back === true, rep);
  ok('в ленте подсвечен ровно один блок — открытый',
    repStrip.filter(x => x.on).length === 1 && (repStrip.find(x => x.on) || {}).n === 'Отчёты', repStrip.filter(x => x.on));
  ok('в теле блока только его секция',
    (await page.evaluate(() => [...document.querySelectorAll('#content-ag .kb-body [id^="kbs-"]')].map(e => e.id).join(','))) === 'kbs-rep');

  console.log('\n[D] лента переводит из блока в блок, минуя витрину');
  const mat = await page.evaluate(`(()=>{ document.querySelectorAll('#content-ag .kb-si').forEach(function(e){ if(/Материалы/.test(e.textContent)) e.click(); }); return (${head.toString()})(); })()`);
  ok('из «Отчётов» в «Материалы» — один клик', mat.t === 'Материалы' && mat.back === true, mat);
  ok('материалы больше не лежат под всеми разделами — это свой блок',
    (await page.evaluate(() => !!document.querySelector('#content-ag .kb-body #kbs-mat'))) === true);

  console.log('\n[E] числа на плитке и в ленте — одни и те же');
  const both = await page.evaluate(`(()=>{ const s=(${strip.toString()})(); kbBoardBack(); const t=(${tiles.toString()})();
    return { strip:s, tiles:t }; })()`);
  const stripC = n => (both.strip.find(x => x.n === n) || {}).c;
  ok('«Контакты»: 3 и там, и там', stripC('Контакты') === '3' && byName('Контакты') === '3человека',
    { strip: stripC('Контакты'), tile: byName('Контакты') });
  ok('«Материалы»: 2 и там, и там', stripC('Материалы') === '2', stripC('Материалы'));
  ok('стрелка вернула на витрину', both.tiles.length === 10, both.tiles.length);

  console.log('\n[F] период показан там, где он действует');
  const per = await page.evaluate(`(()=>{ kbOpenBlock('cont'); const a=(${head.toString()})();
    kbOpenBlock('rep'); const b=(${head.toString()})(); kbBoardBack(); const c=(${head.toString()})();
    return { cont:a.per, rep:b.per, board:c.per }; })()`);
  ok('в «Контактах» кнопки периода нет — данные проекта целиком', per.cont === false, per);
  ok('в «Отчётах» она есть — фильтр их режет', per.rep === true, per);
  ok('на витрине она есть — фильтр меняет нижний ряд плиток', per.board === true, per);

  console.log('\n[G] пустой блок объясняет, а не показывает ноль');
  const emp = await page.evaluate(`(()=>{ setKbProj('p2'); const t=(${tiles.toString()})();
    kbOpenBlock('rep');
    const e=document.querySelector('#content-ag .kb-eblk');
    const zero=/\\b0\\b/.test((document.querySelector('#content-ag .kb-body')||{}).textContent||'');
    kbOpenBlock('ct');
    const e2=document.querySelector('#content-ag .kb-eblk');
    return { tiles:t, empty:!!e, zero:zero, ctEmpty:!!e2, ctTxt:e2?e2.textContent.replace(/\\s+/g,' ').trim().slice(0,60):'' }; })()`);
  await page.waitForTimeout(150);
  ok('у пустого проекта плитки помечены пунктиром',
    emp.tiles.filter(t => t.mut).length >= 6, emp.tiles.filter(t => t.mut).length);
  ok('пустые «Отчёты» — не карточка с бейджем «0»', emp.empty === true && emp.zero === false, emp);
  ok('пустой «Договор» говорит, откуда он берётся',
    emp.ctEmpty === true && /не заведён/.test(emp.ctTxt), emp.ctTxt);

  console.log('\n[G2] место среди своих проектов');
  const bm = await page.evaluate(() => {
    const c = document.getElementById('content-ag');
    setKbProj('p1'); kbBoardBack();
    const of = n => { const t = [...c.querySelectorAll('.kb-tile')].find(x => x.querySelector('.tn').textContent === n);
      const b = t && t.querySelector('.kb-bm');
      return { has: !!b, cap: b ? b.querySelector('.cap').textContent.trim() : '',
        dots: b ? b.querySelectorAll('.ln i').length : 0 }; };
    return { pass: of('Паспорт'), ct: of('Договор'), rep: of('Отчёты'), cont: of('Контакты'),
      total: c.querySelectorAll('.kb-tile .kb-bm').length };
  });
  console.log('    ' + JSON.stringify(bm));
  ok('у «Паспорта» показано место среди активных проектов',
    bm.pass.has && /медиана 36,5% · 3-е из 4/.test(bm.pass.cap), bm.pass);
  ok('на полосе точка на каждый проект плюс медиана и своя',
    bm.pass.dots === 6, bm.pass.dots);
  ok('«Отчёты» тоже сравниваются: 2 против медианы 1,5',
    bm.rep.has && /медиана 1,5 · 2-е из 4/.test(bm.rep.cap), bm.rep);
  /* У договоров разная длина, и «второе место по остатку дней» не значит
     ничего — там полезна дата, а не место. */
  ok('у «Договора» места нет — сравнивать сроки договоров бессмысленно', bm.ct.has === false, bm.ct);
  ok('у «Контактов» тоже нет — число людей не соревнование', bm.cont.has === false, bm.cont);
  ok('сравнением накрыто пять плиток из десяти', bm.total === 5, bm.total);

  const few = await page.evaluate(() => {
    /* Меньше трёх проектов — не сравниваем: медиана двух чисел ничего не
       значит, а «первое место из двух» вводит в заблуждение. */
    const keep = KB_PROJECTS.slice(0, 2);
    KB_PROJECTS.length = 0; keep.forEach(x => KB_PROJECTS.push(x));
    renderKB();
    const n = document.querySelectorAll('#content-ag .kb-tile .kb-bm').length;
    KB_PROJECTS.length = 0; PROJECTS.forEach(x => KB_PROJECTS.push(x));
    renderKB();
    return n;
  });
  ok('на двух проектах сравнение не показывается вовсе', few === 0, few);

  console.log('\n[H] лица и знаки вместо букв');
  const ph = await page.evaluate(() => {
    setKbProj('p1'); kbBoardBack();
    const c = document.getElementById('content-ag');
    const r = { logo: !!c.querySelector('.kb-pi .lg img'), mark: !!c.querySelector('.kb-bmark img'),
      faces: c.querySelectorAll('.kb-tile .kb-face').length,
      facePh: c.querySelectorAll('.kb-tile .kb-face img').length,
      marks: c.querySelectorAll('.kb-tile .kb-mmark').length };
    kbOpenBlock('cont'); r.cardPh = c.querySelectorAll('.kb-ccard-av img').length;
    kbOpenBlock('tg');   r.tgPh = c.querySelectorAll('.kb-tgp-av img').length;
    kbBoardBack();
    return r;
  });
  console.log('    ' + JSON.stringify(ph));
  ok('у проекта в списке стоит логотип, а не буква', ph.logo === true, ph);
  ok('логотип повторён в шапке досье', ph.mark === true, ph);
  /* Трое на проекте: у контактного лица клиента фото нет — оно живёт в
     JSON контактов, а не в профиле, — поэтому лиц три, фотографий две. */
  ok('на плитке «Контакты» стопка из трёх лиц', ph.faces === 3, ph.faces);
  ok('две из них — фотографии, третья осталась инициалом', ph.facePh === 2, ph.facePh);
  ok('на плитке «Материалы» знаки сервисов — Miro и Google Doc', ph.marks === 2, ph.marks);
  ok('в карточках контактов фотографии из профиля', ph.cardPh === 2, ph.cardPh);
  ok('в списке участников группы — те же лица', ph.tgPh === 2, ph.tgPh);

  ok('страница не сыпала ошибок', errs.length === 0, errs.slice(0, 3));
  console.log(`\n──────── ${pass} ok · ${fail} fail ────────`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
