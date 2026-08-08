/* probe_ctfmt — формат публикации: Reels, карусель, публикация.

   Формат появился поздно, поверх уже написанных отчётов, поэтому вся проверка
   вертится вокруг одного вопроса: не сломалось ли то, что было раньше.

   Устройство, которое проверяем. Хранилище осталось раздельным — payload.reels
   и payload.posts: на нём держатся «кол-во Reels», «кол-во постов», разбор
   скриншотов, презентация и плитки базы знаний. Массив решает «Reels или
   лента», новое поле format — «карусель или одиночная публикация». Источник
   истины поэтому двойной и непротиворечивый: положить карусель в reels нельзя,
   такой записи не бывает. Отчёты, заведённые до появления поля, читаются без
   единой поправки и попадают в «публикации».

   Отсюда и список того, что здесь может сломаться:

   · старый отчёт без поля format обязан читаться ровно как раньше;
   · смена формата обязана переносить запись между массивами — иначе счётчик
     «кол-во Reels» посчитает карусель за Reels и разойдётся со списком;
   · свёртка копий обязана пережить переклассификацию: если публикацию в новом
     отчёте уточнили с «публикации» на «карусель», это та же публикация, а не
     вторая;
   · фильтр форматов обязан предлагать только те форматы, которые в выборке
     есть, — иначе он ведёт в гарантированно пустой экран;
   · один общий шаг мастера обязан показывать оба массива и ничего не терять. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const ПУБ = { title:'п', rubric:'Р', views:1000, reach:1000, likes:50, comments:5, saves:10, shares:4 };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  /* ── [A] чтение формата: массив решает первым ───────────────────────────── */
  console.log('[A] откуда берётся формат');
  const A = await page.evaluate(() => ({
    reelsИгнорируетПоле: ctKindOf({ format:'carousel' }, 'reel'),   // в reels каруселей не бывает
    reelsБезПоля:        ctKindOf({}, 'reel'),
    лентаБезПоля:        ctKindOf({}, 'post'),                      // старый отчёт
    лентаNull:           ctKindOf({ format:null }, 'post'),
    лентаКарусельЛат:    ctKindOf({ format:'carousel' }, 'post'),
    лентаКарусельРус:    ctKindOf({ format:'Карусель' }, 'post'),
    лентаПробелы:        ctKindOf({ format:'  CAROUSEL  ' }, 'post'),
    лентаПубликация:     ctKindOf({ format:'post' }, 'post'),
    лентаМусор:          ctKindOf({ format:'что-то' }, 'post'),     // неизвестное — не карусель
    видыОбъявлены:       CT_KINDS.join(','),
    подписи:             CT_KINDS.map(k => CT_KIND_ONE[k] + '/' + CT_KIND_MANY[k]).join(' '),
  }));
  ok('в reels формат всегда Reels, поле не спорит', A.reelsИгнорируетПоле === 'reel', A.reelsИгнорируетПоле);
  ok('reels без поля — Reels', A.reelsБезПоля === 'reel', A.reelsБезПоля);
  ok('старая лента без поля — публикация', A.лентаБезПоля === 'post', A.лентаБезПоля);
  ok('пустое поле не ломает чтение', A.лентаNull === 'post', A.лентаNull);
  ok('карусель латиницей распознана', A.лентаКарусельЛат === 'carousel', A.лентаКарусельЛат);
  ok('карусель по-русски и в любом регистре тоже', A.лентаКарусельРус === 'carousel', A.лентаКарусельРус);
  ok('пробелы вокруг значения не мешают', A.лентаПробелы === 'carousel', A.лентаПробелы);
  ok('явная публикация остаётся публикацией', A.лентаПубликация === 'post', A.лентаПубликация);
  ok('неизвестное значение уходит в публикацию, а не в отдельный формат', A.лентаМусор === 'post', A.лентаМусор);
  ok('форматов ровно три', A.видыОбъявлены === 'reel,carousel,post', A.видыОбъявлены);
  ok('у каждого есть подпись в единственном и множественном', !/undefined/.test(A.подписи), A.подписи);

  /* ── [B] формат доезжает до публикации и до порога зрелости ─────────────── */
  console.log('[B] формат в разобранной публикации');
  const B = await page.evaluate(({ пуб }) => {
    const п = o => Object.assign({}, пуб, o || {});
    const row = { id:'r1', project_id:'p1', published_at:'2026-08-01T00:00:00Z',
      payload:{ period:'МАЙ',
        reels:[п({ title:'рилс' })],
        posts:[п({ title:'кару', format:'carousel' }), п({ title:'пост' })] } };
    const u = ctUnits(row, { name:'П' });
    const по = {}; u.forEach(x => { по[x.title] = x.kind; });
    /* Порог зрелости у карусели — ленточный: она живёт в той же ленте. */
    const зрел = (kind, дней) => ctMaturity({ kind:kind, publishedAt:'2026-08-01T00:00:00Z',
      snapshotAt:'2026-08-01T00:00:00Z' }, Date.parse('2026-08-01T00:00:00Z') + дней*86400000);
    return { по: по, ключи: u.map(x => x.key),
      каруселиЖёсткий: зрел('carousel', 2), каруселиСозрела: зрел('carousel', 4),
      постЖёсткий: зрел('post', 2), рилсМолод: зрел('reel', 4), рилсСозрел: зрел('reel', 15) };
  }, { пуб: ПУБ });
  ok('рилс прочитан как Reels', B.по['рилс'] === 'reel', B.по);
  ok('карусель прочитана как карусель', B.по['кару'] === 'carousel', B.по);
  ok('обычный пост прочитан как публикация', B.по['пост'] === 'post', B.по);
  ok('ключ публикации остался привязан к массиву, а не к формату',
      B.ключи.filter(k => /:post:/.test(k)).length === 2, B.ключи);
  ok('карусель до трёх суток — незрелая', B.каруселиЖёсткий === 'young', B.каруселиЖёсткий);
  ok('и созревает по ленточному сроку, а не по рилсовому',
      B.каруселиСозрела === 'soft' && B.постЖёсткий === 'young', B);
  ok('порог Reels не поехал', B.рилсМолод === 'young' && B.рилсСозрел === 'mature', B);

  /* ── [C] свёртка копий переживает переклассификацию ─────────────────────── */
  console.log('[C] уточнили формат — публикация не удвоилась');
  const C = await page.evaluate(({ пуб }) => {
    const п = o => Object.assign({}, пуб, o || {});
    /* Один и тот же пост в двух отчётах одного профиля за один период:
       в свежем его уточнили до карусели. Это одна публикация. */
    const старый = { id:'1', project_id:'p1', title:'Отчёт А', published_at:'2026-08-01T00:00:00Z',
      payload:{ period:'МАЙ', reels:[], posts:[п({ title:'Гайд' })] } };
    const свежий = { id:'2', project_id:'p1', title:'Отчёт Б', published_at:'2026-08-05T00:00:00Z',
      payload:{ period:'МАЙ', reels:[], posts:[п({ title:'Гайд', format:'carousel' })] } };
    const st = ctBuild([старый, свежий], { projects:[{ id:'p1', name:'П' }] });
    /* А вот одноимённые рилс и пост — разные публикации: рилс переснимают
       для ленты, и складывать их в одну нельзя. */
    /* Названия отчётов разные: одинаковые свернула бы первая свёртка — по
       отчётам, — и вторую мы бы так и не проверили. */
    const оба = ctBuild([{ id:'3', project_id:'p1', title:'Отчёт А', published_at:'2026-08-01T00:00:00Z',
      payload:{ period:'МАЙ', reels:[п({ title:'Гайд' })], posts:[] } },
      { id:'4', project_id:'p1', title:'Отчёт Б', published_at:'2026-08-05T00:00:00Z',
      payload:{ period:'МАЙ', reels:[], posts:[п({ title:'Гайд' })] } }], { projects:[{ id:'p1', name:'П' }] });
    return { публикаций: st.units.length, вид: st.units.map(u => u.kind).join(','),
             изСвежего: st.units.length === 1 ? st.units[0].reportId : null,
             разныеПоловины: оба.units.length };
  }, { пуб: ПУБ });
  ok('переклассифицированная публикация не удвоилась', C.публикаций === 1, C);
  ok('и осталась версия из свежего отчёта', C.вид === 'carousel' && C.изСвежего === '2', C);
  ok('но рилс и пост с одним названием — всё ещё две публикации', C.разныеПоловины === 2, C.разныеПоловины);

  /* ── [D] фильтр: список по факту и честная выборка ──────────────────────── */
  console.log('[D] фильтр форматов');
  const D = await page.evaluate(({ пуб }) => {
    const п = o => Object.assign({}, пуб, o || {});
    const отч = (id, pid, per, r, ps) => ({ id:id, project_id:pid, title:'о',
      published_at:'2026-08-0' + id + 'T00:00:00Z',
      payload:{ period:per, reels:r.map(t => п({ title:t })),
                posts:ps.map(x => п({ title:x[0], format:x[1] })) } });
    PROJECTS.length = 0;
    PROJECTS.push({ id:'p1', name:'Первый' }, { id:'p2', name:'Второй' });
    CT_RAW = [
      отч('1', 'p1', 'МАЙ',  ['р1','р2'], [['к1','carousel'], ['п1', null]]),
      отч('2', 'p1', 'ИЮНЬ', ['р3'],      []),                       // в июне только Reels
      отч('3', 'p2', 'МАЙ',  [],          [['к2','carousel']])       // у второго только карусели
    ];
    CT_SIG = ctSig(); CT_AT = Date.now();
    CT.tab = 'content'; CT.project = ''; CT.period = ''; CT.kind = 'all';
    CT.exclude = []; CT.matureOnly = false;

    const строки = ctRows();
    const пункты = () => { renderContentFx();
      const m = document.getElementById('seldd-cfx-kind');
      return m ? [].slice.call(m.querySelectorAll('.dd-opt')).map(o => o.textContent.trim()) : null; };
    const выборка = k => { CT.kind = k; renderContentFx();
      const s = ctState(); return { n:s.units.length, виды:Array.from(new Set(s.units.map(u => u.kind))).sort().join(',') }; };

    const всеТри = пункты();
    const все = выборка('all'), рилсы = выборка('reel'),
          кару = выборка('carousel'), посты = выборка('post');

    CT.kind = 'all'; CT.project = 'p1'; CT.period = 'ИЮНЬ';
    const вИюне = пункты();                                    // в этом периоде только Reels
    const скрытВИюне = !document.getElementById('seldd-cfx-kind');

    CT.kind = 'carousel'; renderContentFx();                   // формат из другого периода
    const самолечение = { формат:CT.kind, публикаций:ctState().units.length,
                          пусто: !!document.querySelector('#content-ag .cfx-empty') };

    CT.project = 'p2'; CT.period = ''; CT.kind = 'all';
    const уВторого = пункты();
    const скрытУВторого = !document.getElementById('seldd-cfx-kind');

    CT.project = ''; CT.period = ''; CT.kind = 'all'; renderContentFx();
    return { всеТри, все, рилсы, кару, посты, вИюне, скрытВИюне, самолечение, уВторого, скрытУВторого,
             форматыПериода: ctFormats(строки, 'p1', 'ИЮНЬ').join(','),
             форматыПрофиля: ctFormats(строки, 'p2', '').join(','),
             форматыВсего:   ctFormats(строки, '', '').join(',') };
  }, { пуб: ПУБ });
  ok('в списке все три формата, когда все три есть',
      D.всеТри && D.всеТри.join(',') === 'Все форматы,Reels,Карусели,Публикации', D.всеТри);
  ok('«Все форматы» показывает всё', D.все.n === 6 && D.все.виды === 'carousel,post,reel', D.все);
  ok('и сумма по форматам сходится с «Все форматы»',
      D.рилсы.n + D.кару.n + D.посты.n === D.все.n, [D.рилсы.n, D.кару.n, D.посты.n, D.все.n]);
  ok('«Reels» показывает только Reels', D.рилсы.n === 3 && D.рилсы.виды === 'reel', D.рилсы);
  ok('«Карусели» показывают только карусели', D.кару.n === 2 && D.кару.виды === 'carousel', D.кару);
  ok('«Публикации» показывают только публикации', D.посты.n === 1 && D.посты.виды === 'post', D.посты);
  ok('форматы считаются по профилю', D.форматыПрофиля === 'carousel', D.форматыПрофиля);
  ok('и по периоду тоже', D.форматыПериода === 'reel', D.форматыПериода);
  ok('без фильтров видны все три', D.форматыВсего === 'reel,carousel,post', D.форматыВсего);
  ok('в периоде с одним форматом списка нет вовсе', D.скрытВИюне && D.вИюне === null, D);
  ok('у профиля с одним форматом — тоже', D.скрытУВторого && D.уВторого === null, D);
  ok('формат из другого периода чинится сам, а не даёт пустой экран',
      D.самолечение.формат === 'all' && D.самолечение.публикаций === 1 && !D.самолечение.пусто, D.самолечение);

  /* ── [E] формат виден на экране, а не только в состоянии ────────────────── */
  console.log('[E] формат назван в паспорте публикации');
  const E = await page.evaluate(({ пуб }) => {
    const п = o => Object.assign({}, пуб, o || {});
    PROJECTS.length = 0; PROJECTS.push({ id:'p1', name:'Первый' });
    CT_RAW = [{ id:'1', project_id:'p1', title:'о', published_at:'2026-08-01T00:00:00Z',
      payload:{ period:'МАЙ', reels:[п({ title:'рилс' })],
                posts:[п({ title:'кару', format:'carousel' }), п({ title:'пост' })] } }];
    CT_SIG = ctSig(); CT_AT = Date.now();
    CT.tab = 'content'; CT.project = ''; CT.period = ''; CT.kind = 'all';
    CT.exclude = []; CT.matureOnly = false; renderContentFx();
    const st = ctState();
    const подпись = (title) => {
      const u = st.units.filter(x => x.title === title)[0];
      ctOpen(u.key);
      const p = document.querySelector('#ov-pd2 .cfx-pass .modal-h p');
      const t = p ? p.textContent.replace(/\s+/g, ' ').trim() : null;
      if (typeof pd2Close === 'function') pd2Close();
      return t;
    };
    return { рилс: подпись('рилс'), кару: подпись('кару'), пост: подпись('пост') };
  }, { пуб: ПУБ });
  ok('у Reels в паспорте написано Reels', /Reels/.test(E.рилс || ''), E.рилс);
  ok('у карусели — карусель', /карусель/.test(E.кару || ''), E.кару);
  ok('у публикации — публикация', /публикация/.test(E.пост || ''), E.пост);

  /* ── [J] формат в списке — только когда он различает ─────────────────────── */
  console.log('[J] формат на карточке и в таблице');
  const J = await page.evaluate(() => {
    const надстрочники = () => [].slice.call(document.querySelectorAll('#content-ag .cfx-rub'))
      .map(e => e.textContent.replace(/\s+/g, ' ').trim());
    const метки = () => [].slice.call(document.querySelectorAll('#content-ag .cfx-tbl .cfx-tk'))
      .map(e => e.textContent.trim());
    CT.kind = 'all'; CT.view = 'tiles'; renderContentFx();
    const плиткиСмешанные = надстрочники();
    CT.kind = 'reel'; renderContentFx();
    const плиткиОдин = надстрочники();
    CT.kind = 'all'; CT.view = 'table'; renderContentFx();
    const таблицаСмешанная = метки();
    CT.kind = 'carousel'; renderContentFx();
    const таблицаОдин = метки();
    CT.kind = 'all'; CT.view = 'tiles'; renderContentFx();
    return { плиткиСмешанные, плиткиОдин, таблицаСмешанная, таблицаОдин };
  });
  ok('в смешанной выборке карточка называет формат',
      J.плиткиСмешанные.filter(t => /· Reels|· карусель|· публикация/.test(t)).length === 3,
      J.плиткиСмешанные);
  ok('когда формат один — на карточке о нём молчим',
      J.плиткиОдин.length === 1 && !/·/.test(J.плиткиОдин[0]), J.плиткиОдин);
  ok('в смешанной таблице у каждой строки метка формата',
      J.таблицаСмешанная.length === 3
      && J.таблицаСмешанная.slice().sort().join(',') === 'Reels,карусель,публикация',
      J.таблицаСмешанная);   // порядок строк задаёт индекс, а не массив
  ok('в таблице одного формата меток нет', J.таблицаОдин.length === 0, J.таблицаОдин);

  /* ── [F] редактор: один список вместо двух ──────────────────────────────── */
  console.log('[F] шаг «Контент» показывает оба массива');
  const F = await page.evaluate(() => {
    window.LIVE = false; window.SB = null; window.toast = m => { window.__t = m; };
    openSMM({ id:'r1', project_id:'p1', title:'SMM', published_at:'2026-08-08',
      payload:{ period:'МАЙ', metrics:{}, prev:{}, goals:{}, rubrics:[],
        reels:[{ title:'рилс', views:100, reach:100, likes:5 }],
        posts:[{ title:'кару', format:'carousel', views:100, reach:100, likes:5 },
               { title:'пост', views:100, reach:100, likes:5 }] } });
    _smmTab = 'data'; smmRender();
    const шаги = (window._smmSteps || []).map(s => s.t);
    _smmStep = шаги.indexOf('Контент'); smmWzBody();
    return {
      шаги: шаги,
      строк: document.querySelectorAll('#smm-content-ed .smm-rrow').length,
      метки: [].slice.call(document.querySelectorAll('#smm-content-ed .smm-rrow .smm-ftag')).map(e => e.textContent),
      кнопка: [].slice.call(document.querySelectorAll('#smm-content-ed .smm-mini-btn')).map(e => e.textContent).filter(t => /Добавить/.test(t))[0],
      счётчики: [].slice.call(document.querySelectorAll('#smm-content-ed .smm-fc-ro')).map(e => e.textContent.replace(/\s+/g, ' ').trim()),
      порядок: smmItems().map(x => x.r.title + ':' + x.fmt).join(','),
    };
  });
  ok('шага «Reels» и шага «Посты» больше нет',
      F.шаги.indexOf('Reels') < 0 && F.шаги.indexOf('Посты') < 0, F.шаги);
  ok('вместо них один шаг «Контент»', F.шаги.indexOf('Контент') === 1, F.шаги);
  ok('шагов стало шесть', F.шаги.length === 6, F.шаги.length);
  ok('в списке весь контент из обоих массивов', F.строк === 3, F.строк);
  ok('у каждой строки своя метка формата',
      F.метки.join(',') === 'Reels,Карусель,Публикация', F.метки);
  ok('кнопка зовёт добавить контент, а не Reels', F.кнопка === '+ Добавить контент', F.кнопка);
  ok('счётчики разложены по форматам',
      F.счётчики.length === 4 && /Всего публикаций/.test(F.счётчики[0])
      && /Reels.*1$/.test(F.счётчики[1]) && /Карусели.*1$/.test(F.счётчики[2])
      && /Публикации.*1$/.test(F.счётчики[3]), F.счётчики);
  ok('Reels идут первыми, лента следом', F.порядок === 'рилс:reel,кару:carousel,пост:post', F.порядок);

  /* ── [G] смена формата переносит запись между массивами ─────────────────── */
  console.log('[G] переезд между массивами');
  const G = await page.evaluate(() => {
    const снимок = () => ({ reels:_smmCur.reels.map(r => r.title), posts:_smmCur.posts.map(r => r.title),
      счётRe:(_smmCur.metrics||{}).reels_count, счётПост:(_smmCur.metrics||{}).posts_count });

    /* Новая запись как карусель — обязана лечь в posts, а не в reels. */
    smmReelModalOpen(-1, 'item');
    smmModalFmtPick('carousel');
    document.getElementById('srm-title').value = 'новая карусель';
    document.getElementById('srm-views').value = '2000';
    document.getElementById('srm-reach').value = '1000';
    document.getElementById('srm-likes').value = '100';
    smmReelModalSave();
    const снять = () => { smmComputeGeneral(); return снимок(); };
    const создание = снять();

    /* Окно обязано открываться на формате самой записи. Проверяем на
       карусели: на Reels любой дефект «всегда Reels» выглядел бы верным. */
    smmReelModalOpen(_smmCur.posts.findIndex(r => r.title === 'кару'), 'post');
    const открылсяС = _smmModalFmt;
    smmReelModalClose();

    /* Существующий рилс переводим в карусель — переезжает в posts. */
    const iРилс = _smmCur.reels.findIndex(r => r.title === 'рилс');
    smmReelModalOpen(iРилс, 'reel');
    const открылсяСРилса = _smmModalFmt;
    smmModalFmtPick('carousel'); smmReelModalSave();
    const изReelsВЛенту = снять();

    /* И обратно — карусель в Reels. */
    const iКару = _smmCur.posts.findIndex(r => r.title === 'кару');
    smmRowFmt(iКару, 'post', 'reel');
    const изЛентыВReels = снять();

    /* Ставка пересчитана из счётчиков, а не унаследована. */
    const нов = _smmCur.posts.filter(r => r.title === 'новая карусель')[0];
    return { создание, открылсяС, открылсяСРилса, изReelsВЛенту, изЛентыВReels,
             ставка: нов ? +Number(нов.er).toFixed(2) : null,
             формат: нов ? нов.format : null };
  });
  ok('новая карусель легла в ленту, а не в Reels',
      G.создание.posts.indexOf('новая карусель') >= 0 && G.создание.reels.indexOf('новая карусель') < 0, G.создание);
  ok('и «кол-во постов» посчитало её', G.создание.счётПост === 3 && G.создание.счётRe === 1, G.создание);
  ok('окно открылось на текущем формате записи',
      G.открылсяС === 'carousel' && G.открылсяСРилса === 'reel', [G.открылсяС, G.открылсяСРилса]);
  ok('перевод Reels в карусель переносит запись в ленту',
      G.изReelsВЛенту.reels.indexOf('рилс') < 0 && G.изReelsВЛенту.posts.indexOf('рилс') >= 0, G.изReelsВЛенту);
  ok('и счётчик Reels сразу это видит', G.изReelsВЛенту.счётRe === 0, G.изReelsВЛенту);
  ok('обратный перевод возвращает запись в Reels',
      G.изЛентыВReels.reels.indexOf('кару') >= 0 && G.изЛентыВReels.posts.indexOf('кару') < 0, G.изЛентыВReels);
  ok('ставка новой записи посчитана из счётчиков', G.ставка === 10, G.ставка);
  ok('формат записан в саму запись', G.формат === 'carousel', G.формат);

  /* ── [H] вставка из таблицы ─────────────────────────────────────────────── */
  console.log('[H] вставка из Excel знает про формат');
  const H = await page.evaluate(() => {
    openSMM({ id:'r2', project_id:'p1', title:'SMM', published_at:'2026-08-08',
      payload:{ period:'МАЙ', metrics:{}, prev:{}, goals:{}, rubrics:[], reels:[], posts:[] } });
    _smmTab = 'data'; smmRender();
    _smmStep = (window._smmSteps || []).map(s => s.t).indexOf('Контент'); smmWzBody();
    smmPasteFmt('reel');
    document.getElementById('smm-paste-ta-item').value =
      ['заголовок\tпросмотры\tохват\tлайки\tкомм\tсохр\tрепосты\tрубрика\tформат',
       'без столбца\t100\t100\t10\t1\t1\t1\tР',
       'явный рилс\t100\t100\t10\t1\t1\t1\tР\treels',
       'карусель\t100\t100\t10\t1\t1\t1\tР\tкарусель',
       'публикация\t100\t100\t10\t1\t1\t1\tР\tпубликация',
       'мусор в столбце\t100\t100\t10\t1\t1\t1\tР\tчто-то'].join('\n');
    smmPasteImport();
    const отчёт = (document.getElementById('smm-paste-res-item') || {}).textContent || '';
    const по = {}; smmItems().forEach(x => { по[x.r.title] = x.fmt; });
    return { по: по, reels:_smmCur.reels.length, posts:_smmCur.posts.length, отчёт: отчёт,
             распознан: [smmPasteFmtOf('Reels'), smmPasteFmtOf('КАРУСЕЛЬ'), smmPasteFmtOf('post'),
                         smmPasteFmtOf(''), smmPasteFmtOf('ерунда')].join(',') };
  });
  ok('без девятого столбца берётся формат переключателя', H.по['без столбца'] === 'reel', H.по);
  ok('девятый столбец переопределяет формат',
      H.по['карусель'] === 'carousel' && H.по['публикация'] === 'post' && H.по['явный рилс'] === 'reel', H.по);
  ok('нераспознанное значение столбца откатывается к переключателю',
      H.по['мусор в столбце'] === 'reel', H.по);
  ok('строки легли в свои массивы', H.reels === 3 && H.posts === 2, H);
  ok('отчёт о вставке разложен по форматам',
      /Добавлено 5/.test(H.отчёт) && /Reels 3/.test(H.отчёт) && /Карусели 1/.test(H.отчёт)
      && /Публикации 1/.test(H.отчёт), H.отчёт);
  ok('распознавание слов формата работает и на регистре, и на пустом',
      H.распознан === 'reel,carousel,post,,', H.распознан);

  /* ── [I] сохранение и повторное чтение ──────────────────────────────────── */
  console.log('[I] формат переживает сохранение');
  const I = await page.evaluate(() => {
    /* Что уедет в базу — то и вернётся: сверяем разбор payload модулем с тем,
       что видит редактор. Иначе формат мог бы жить только в памяти вкладки. */
    const payload = JSON.parse(JSON.stringify(_smmCur));
    const u = ctUnits({ id:'x', project_id:'p1', published_at:'2026-08-08', payload:payload }, null);
    const по = {}; u.forEach(x => { по[x.title] = x.kind; });
    const вРедакторе = {}; smmItems().forEach(x => { вРедакторе[x.r.title] = x.fmt; });
    const сходится = Object.keys(вРедакторе).every(k => вРедакторе[k] === по[k]);
    return { сходится: сходится, вМодуле: по, вРедакторе: вРедакторе,
             естьПоле: payload.posts.every(p => 'format' in p) };
  });
  ok('модуль читает форматы ровно так же, как их видит редактор', I.сходится, I);
  ok('поле format реально записано в payload', I.естьПоле, I.естьПоле);

  /* ── [K] презентация показывает весь контент ────────────────────────────── */
  console.log('[K] презентация: лента больше не пропадает');
  const K = await page.evaluate(() => {
    const п = o => Object.assign({ rubric:'Р', views:1000, reach:1000, likes:50, comments:5, saves:10, shares:4, er:6.5 }, o);
    openSMM({ id:'r3', project_id:'p1', title:'SMM', published_at:'2026-08-08',
      payload:{ period:'МАЙ', metrics:{}, prev:{}, goals:{}, rubrics:[],
        reels:[п({ title:'рилс', er:7.5 })],
        posts:[п({ title:'кару', format:'carousel', er:9 }), п({ title:'пост', er:6 })] } });
    _smmTab = 'preview'; smmRender();
    const sec = document.getElementById('smm-reels-sec');
    const текст = sec ? sec.textContent.replace(/\s+/g, ' ') : '';
    const подписи = sec ? [].slice.call(sec.querySelectorAll('div'))
      .map(e => e.textContent.trim())
      .filter(t => /^(Топ · )?(Reels|Карусель|Публикация)$/.test(t)) : [];

    /* Отчёт, где есть только лента, — заполненный: раньше smmHasData смотрел
       на одни reels, и такой отчёт открывался на «Данных» как пустой. */
    const толькоЛента = smmHasData({ payload:{ reels:[], posts:[п({ title:'п' })], rubrics:[], metrics:{} } });
    const совсемПустой = smmHasData({ payload:{ reels:[], posts:[], rubrics:[], metrics:{} } });

    /* Пустая презентация зовёт добавить публикации, а не Reels. */
    openSMM({ id:'r4', project_id:'p1', title:'SMM', published_at:'2026-08-08',
      payload:{ period:'МАЙ', metrics:{}, prev:{}, goals:{}, rubrics:[], reels:[], posts:[] } });
    _smmTab = 'preview'; smmRender();
    const пусто = (document.getElementById('smm-reels-sec') || {}).textContent || '';
    return { есть: ['рилс','кару','пост'].map(t => текст.indexOf(t) >= 0),
             подписи: подписи, толькоЛента: толькоЛента, совсемПустой: совсемПустой, пусто: пусто };
  });
  ok('в презентацию попали все три формата', K.есть.every(Boolean), K.есть);
  ok('и у каждой карточки назван формат',
      K.подписи.length === 3 && /Карусель/.test(K.подписи.join(',')) && /Публикация/.test(K.подписи.join(',')),
      K.подписи);
  ok('первая карточка помечена как топ', /^Топ · /.test(K.подписи[0] || ''), K.подписи[0]);
  ok('отчёт из одной ленты считается заполненным', K.толькоЛента === true, K.толькоЛента);
  ok('и пустой по-прежнему пустой', K.совсемПустой === false, K.совсемПустой);
  ok('пустая презентация зовёт добавить публикации, а не Reels',
      /Добавьте публикации/.test(K.пусто) && !/Reels/.test(K.пусто), K.пусто.slice(0, 90));

  ok('без ошибок на странице', errs.length === 0, errs.slice(0, 3));
  console.log('\n' + pass + ' ok · ' + fail + ' fail');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
