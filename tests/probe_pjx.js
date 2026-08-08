/* probe_pjx — справочник сложности и конструктор метрик SMM-плитки.

   Главное, что здесь проверяется, — не «окно открылось», а два обещания:
   · справочник обязан показывать ровно ту арифметику, по которой карточка
     получила свой вердикт. Если он пересчитает формулу по-своему, однажды
     документ и гейдж разойдутся, и доверие к обоим кончится;
   · конструктор метрик обязан быть настройкой показа и ничем больше. Он не
     имеет права трогать ни поля отчёта, ни сами значения — только решать,
     какие из уже посчитанных чисел показать. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'detroyd', role: 'agency_owner', agency_id: 'AG', agencySlug: 'probe' };
  window.tMe = () => window.__me; window.ME = window.__me;
  window.__toasts = []; window.toast = t => window.__toasts.push(t);
  window.LIVE = false;
  window.agIsOwner = () => true; window.agCanEditProject = () => true; window.agCanSeeProject = () => true;
  try { localStorage.removeItem('pjh_smmcard_v1_AG'); } catch (_e) {}
  TEAM = [{ _id: 'm1', name: 'Пётр Смирнов', role: 'PM', dept: 'Аккаунтинг', color: '#37E6C8', avatar: null }];
  const P = (id, name, extra) => Object.assign({
    id, name, logo: name[0], logoUrl: null, cat: 'IT компания', svc: 'PROD', pct: 40,
    stages: '1 / 7', status: 'active', mrr: 6000000, cost: 3000000, lead_id: 'm1',
    _stages: [], _tasks: [], _reports: [], _team: [{ name: 'Пётр Смирнов', color: '#37E6C8', avatar: null, _id: 'm1' }],
    _pipeline: { done: 1, active: 1, wait: 5, total: 7 }, _taskAgg: { done: 0, total: 0 },
    _lead: { name: 'Пётр Смирнов', color: '#37E6C8', avatar: null, _id: 'm1' }
  }, extra || {});
  PROJECTS = [P('p1', 'Artel'), P('p2', 'Без замеров'), P('p3', 'Мало замеров'), P('p4', 'Полупустой отчёт')];

  /* Циклы: p1 — зрелая выборка, p3 — две штуки, p2 — вообще ничего */
  CYCLES.clients = [
    { pid: 'p1', client: 'Artel', n: 9, medianMs: 2.1 * 86400000, avgMs: 2.6 * 86400000, reworkPct: 10 },
    { pid: 'p3', client: 'Мало замеров', n: 2, medianMs: 0.25 * 86400000, avgMs: 0.3 * 86400000, reworkPct: null }
  ];

  /* Два отчёта подряд — чтобы появились тренды; у p4 половина полей пустая */
  _smmLbAll = [
    { reportId: 'r2', proj: { id: 'p1' }, m: { er: 8.8, lr: 6.1, tr: 0.42, shr: 0.9, sr: 1.38,
      subscribers_current: 178438, total_reach: 1134533, total_views: 1953985, content_total: 95 } },
    { reportId: 'r1', proj: { id: 'p1' }, m: { er: 7.9, lr: 5.4, tr: 0.51, shr: 0.7, sr: 1.30,
      subscribers_current: 171200, total_reach: 980112, total_views: 1610500, content_total: 88 } },
    { reportId: 'r0', proj: { id: 'p4' }, m: { er: 4.0, total_reach: 200000, reels_count: 10, reels_views: 51000 } }
  ];
  window.__reportSnapshot = JSON.stringify(_smmLbAll);

  window.__calls = [];
  window.openProject = i => window.__calls.push(['openProject', i]);
  window.smmOpenFromLb = async id => { window.__calls.push(['smmOpenFromLb', String(id)]); };

  [...document.body.children].forEach(e => { if (e.id !== 'app-ag' && !/^(SCRIPT|STYLE|LINK)$/.test(e.tagName)) e.style.display = 'none'; });
  document.getElementById('app-ag').classList.add('on');
  agNav('projects'); paintProjList();
  window.__card = n => [...document.querySelectorAll('#pj-list .pjh')].find(c => (c.querySelector('.pjh-name-t') || {}).textContent === n);
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 1100 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup);
  await page.waitForTimeout(350);

  /* ═════════ A. карточка «Сложность» ═════════ */
  console.log('\n[A] карточка сложности');
  const A = await page.evaluate(() => {
    const pick = n => { const c = window.__card(n);
      const el = [...c.querySelectorAll('.pjh-card, button.pjh-card')].find(x => (x.querySelector('.pjh-lbl') || {}).textContent === 'Сложность');
      return { tag: el.tagName, click: el.getAttribute('onclick') || '',
        val: el.querySelector('.pjh-val').textContent.trim(), sub: el.querySelector('.pjh-cs').textContent.trim() }; };
    return { a: pick('Artel'), b: pick('Без замеров'), c: pick('Мало замеров') };
  });
  ok('«Сложность» — кнопка', A.a.tag === 'BUTTON', A.a.tag);
  ok('ведёт в справочник этого проекта', /pjcxOpen\('p1'\)/.test(A.a.click), A.a.click);
  ok('вердикт «Средняя»', A.a.val === 'Средняя', A.a.val);
  ok('подпись называет цикл и возвраты', /цикл 2,1 дн · 10% возвратов/.test(A.a.sub), A.a.sub);
  ok('«стабильная нагрузка» больше не врёт с экрана', !/стабильн/.test(A.a.sub + A.b.sub + A.c.sub), [A.a.sub, A.b.sub, A.c.sub]);
  ok('без замеров — честное «нет замеров»', A.b.sub === 'нет замеров' && A.b.val === 'нет замеров', A.b);
  ok('при малой выборке возвраты не выдумываются', /возвратов не считали/.test(A.c.sub), A.c.sub);

  /* ═════════ B. справочник ═════════ */
  console.log('\n[B] справочник');
  await page.evaluate(() => pjcxOpen('p1'));
  await page.waitForTimeout(300);
  const B = await page.evaluate(() => {
    const ov = document.getElementById('ov-pjcx');
    const rows = [...ov.querySelectorAll('.pjd-cr')].map(r => ({
      t: r.querySelector('.pjd-cr-h b').textContent, w: r.querySelector('.w').textContent,
      score: r.querySelector('.pjd-cr-v').textContent, fact: r.querySelector('.pjd-cr-f span').textContent,
      add: r.querySelector('.pjd-cr-f b').textContent }));
    return { open: ov.classList.contains('on'), verd: ov.querySelector('.pjd-verd').textContent,
      score: ov.querySelector('.pjd-score b').textContent, rows,
      sum: ov.querySelector('.pjd-sum b').textContent,
      secs: [...ov.querySelectorAll('.pjd-s h4')].map(x => x.textContent.replace(/^\d/, '').trim()),
      scale: [...ov.querySelectorAll('.pjd-tbl .pjd-tr')].length,
      now: (ov.querySelector('.pjd-tr.now span') || {}).textContent || '',
      trust: ov.querySelector('.pjd-note').textContent, levers: ov.querySelectorAll('.pjd-ol li').length };
  });
  ok('окно открылось', B.open);
  ok('вердикт совпадает с карточкой', B.verd === 'Средняя', B.verd);
  ok('балл 48', B.score === '48', B.score);
  ok('пять разделов', B.secs.length === 5, B.secs);
  ok('три слагаемых', B.rows.length === 3, B.rows.map(r => r.t));
  ok('веса 45/30/25', B.rows.map(r => r.w).join() === 'вес 45%,вес 30%,вес 25%', B.rows.map(r => r.w));
  ok('скорость цикла — 68 баллов', B.rows[0].score === '68', B.rows[0]);
  ok('и названа медиана 2,1 дня', /медиана этапа — 2,1 дня/.test(B.rows[0].fact), B.rows[0].fact);
  ok('вклад скорости +30,5', B.rows[0].add === '+30,5', B.rows[0].add);
  ok('возвраты — 10 баллов, вклад +3,0', B.rows[1].score === '10' && B.rows[1].add === '+3,0', B.rows[1]);
  ok('длина — 58 баллов от 7 этапов', B.rows[2].score === '58' && /7 этапов/.test(B.rows[2].fact), B.rows[2]);
  /* арифметика документа обязана сходиться с баллом карточки — иначе один и
     тот же проект получает два разных ответа на один вопрос */
  const сумма = B.rows.reduce((s, r) => s + parseFloat(r.add.replace('+', '').replace(',', '.')), 0);
  ok('слагаемые в сумме дают балл карточки', Math.round(сумма) === Number(B.score), [сумма, B.score]);
  ok('итог продублирован внизу', B.sum === B.score, [B.sum, B.score]);
  ok('шкала времени из семи строк', B.scale === 8, B.scale);
  ok('текущее место на шкале подсвечено', /2 дня/.test(B.now), B.now);
  ok('три рычага', B.levers === 3, B.levers);
  ok('выборка названа честно', /Замеров: 9/.test(B.trust), B.trust.slice(0, 60));

  await page.evaluate(() => pjcxOpen('p3'));
  await page.waitForTimeout(220);
  const B3 = await page.evaluate(() => {
    const ov = document.getElementById('ov-pjcx');
    return { note: ov.querySelector('.pjd-note').textContent, warn: !!ov.querySelector('.pjd-note.warn'),
      rework: [...ov.querySelectorAll('.pjd-cr-f span')].map(x => x.textContent)[1] }; });
  ok('о малой выборке предупреждает', B3.warn && /Этого мало/.test(B3.note), B3.note.slice(0, 70));
  ok('и говорит, что возвраты не считались', /замеров мало/.test(B3.rework), B3.rework);

  await page.evaluate(() => pjcxOpen('p2'));
  await page.waitForTimeout(220);
  const B2 = await page.evaluate(() => {
    const ov = document.getElementById('ov-pjcx');
    return { rows: ov.querySelectorAll('.pjd-cr').length, note: ov.querySelector('.pjd-note').textContent,
      score: (ov.querySelector('.pjd-score') || {}).textContent || '', verd: ov.querySelector('.pjd-verd').textContent }; });
  ok('без замеров расчёта нет', B2.rows === 0 && /Пока считать не из чего/.test(B2.note), B2);
  ok('и вместо балла — что для него нужно', /после первого закрытого этапа/.test(B2.score), B2.score);
  ok('фраза «нет замеров» не дублируется', (B2.verd + B2.score).match(/нет замеров/g).length === 1, [B2.verd, B2.score]);
  await page.keyboard.press('Escape'); await page.waitForTimeout(220);
  ok('Escape закрывает справочник', await page.evaluate(() => !document.getElementById('ov-pjcx').classList.contains('on')));

  /* ═════════ C. реестр метрик ═════════ */
  console.log('\n[C] реестр метрик');
  const C = await page.evaluate(() => {
    const m = _smmLbAll[0].m;
    const v = k => pjhMetVal(k, m);
    return { er: v('er'), lr: v('lr'), cr: v('cr'), shr: v('shr'), sr: v('sr'), err: v('err'),
      reach: v('reach'), views: v('views'), content: v('content'), aud: v('aud'),
      empty: pjhMetVal('sr', _smmLbAll[2].m), bogus: pjhMetVal('нет-такой', m),
      fallback: pjhMetVal('views', _smmLbAll[2].m), fbContent: pjhMetVal('content', _smmLbAll[2].m),
      fmtPct: pjhMetFmt('er', 8.8), fmtNum: pjhMetFmt('reach', 1134533), fmtNull: pjhMetFmt('reach', null),
      keys: PJH_MET.map(x => x.k) };
  });
  ok('десять метрик в реестре', C.keys.length === 10, C.keys);
  ok('все девять запрошенных на месте', ['reach','views','content','er','lr','cr','shr','sr','err'].every(k => C.keys.indexOf(k) >= 0), C.keys);
  ok('ER читается как есть', C.er === 8.8, C.er);
  ok('CR берётся из поля комментариев', C.cr === 0.42, C.cr);
  ok('SHR и SR на месте', C.shr === 0.9 && C.sr === 1.38, [C.shr, C.sr]);
  /* ERR = реакции ÷ подписчики. Реакции = ER × охват, потому что ER в отчёте
     считается на охват. 8,8 × 1 134 533 / 178 438 = 55,95 */
  ok('ERR считается на подписчиков, а не повторяет ER', Math.abs(C.err - 55.95) < 0.05 && C.err !== C.er, C.err);
  ok('охват и просмотры абсолютные', C.reach === 1134533 && C.views === 1953985, [C.reach, C.views]);
  ok('контент и аудитория на месте', C.content === 95 && C.aud === 178438, [C.content, C.aud]);
  ok('отсутствующая метрика — null, а не ноль', C.empty === null, C.empty);
  ok('неизвестный ключ не роняет', C.bogus === null, C.bogus);
  /* отчёт может быть заполнен по рилсам, без итоговых полей — тогда метрика
     обязана собраться из частей, а не исчезнуть */
  ok('без итогового поля просмотры собираются из частей', C.fallback === 51000, C.fallback);
  ok('то же и с контентом', C.fbContent === 10, C.fbContent);
  ok('проценты с запятой', C.fmtPct === '8,8%', C.fmtPct);
  ok('крупные числа с разрядами', /^1.134.533$/.test(C.fmtNum), C.fmtNum);
  ok('пусто — прочерк', C.fmtNull === '—', C.fmtNull);

  /* ═════════ D. конструктор ═════════ */
  console.log('\n[D] конструктор');
  const D0 = await page.evaluate(() => {
    const c = window.__card('Artel');
    return { cfg: !!c.querySelector('.pjh-smm-cfg'), click: (c.querySelector('.pjh-smm-cfg') || {}).getAttribute ? c.querySelector('.pjh-smm-cfg').getAttribute('onclick') : '',
      def: JSON.stringify(pjhMetCfg()) }; });
  ok('шестерёнка на плитке', D0.cfg);
  ok('она не открывает проект', /event\.stopPropagation\(\);smmCfgOpen\('p1'\)/.test(D0.click), D0.click);
  ok('раскладка по умолчанию — прежняя пятёрка', D0.def === '{"main":"er","cells":["aud","reach","views","content"]}', D0.def);
  /* в хранилище может лежать что угодно — своя старая версия, чужая рука,
     оборванная запись. Раскладка обязана вычиститься, а не сломать сетку */
  const Dbad = await page.evaluate(() => {
    const back = localStorage.getItem('pjh_smmcard_v1_AG');
    localStorage.setItem('pjh_smmcard_v1_AG', JSON.stringify({ main: 'er', cells: ['er', 'er', 'reach', 'нет-такой'] }));
    const c = pjhMetCfg();
    if (back == null) localStorage.removeItem('pjh_smmcard_v1_AG'); else localStorage.setItem('pjh_smmcard_v1_AG', back);
    return c; });
  ok('основная не дублируется в сетке', Dbad.cells.indexOf('er') < 0, Dbad);
  ok('мусорный ключ выкидывается', Dbad.cells.indexOf('нет-такой') < 0, Dbad);
  ok('и сетка всё равно из четырёх', Dbad.cells.length === 4 && new Set(Dbad.cells).size === 4, Dbad);

  await page.evaluate(() => smmCfgOpen('p1'));
  await page.waitForTimeout(300);
  const D = await page.evaluate(() => {
    const ov = document.getElementById('ov-smmcfg');
    return { open: ov.classList.contains('on'), tiles: ov.querySelectorAll('.smmcfg-t').length,
      main: [...ov.querySelectorAll('.smmcfg-t.is-main .smmcfg-hd b')].map(x => x.textContent),
      cells: [...ov.querySelectorAll('.smmcfg-t.is-cell .smmcfg-hd b')].map(x => x.textContent),
      vals: [...ov.querySelectorAll('.smmcfg-v')].map(x => x.textContent),
      counter: ov.querySelector('.smmcfg-lg b').textContent,
      formula: [...ov.querySelectorAll('.smmcfg-f')].map(x => x.textContent)[0],
      apply: ov.querySelector('.pjq-fb .pri').className };
  });
  ok('окно открылось', D.open);
  ok('десять плиток', D.tiles === 10, D.tiles);
  ok('основная одна и это ER', D.main.length === 1 && D.main[0] === 'ER', D.main);
  ok('в сетке четыре', D.cells.length === 4, D.cells);
  ok('счётчик «4 из 4»', /4 из 4/.test(D.counter), D.counter);
  ok('у метрики видно живое число', D.vals.indexOf('8,8%') >= 0 && D.vals.some(v => /^1\s134\s533$/.test(v)), D.vals);
  ok('и формула словами', /лайки/.test(D.formula), D.formula);
  ok('«Применить» доступна', !/off/.test(D.apply), D.apply);

  await page.evaluate(() => smmCfgMain('sr'));
  await page.waitForTimeout(160);
  const D1 = await page.evaluate(() => {
    const ov = document.getElementById('ov-smmcfg');
    return { main: [...ov.querySelectorAll('.smmcfg-t.is-main .smmcfg-hd b')].map(x => x.textContent),
      cells: [...ov.querySelectorAll('.smmcfg-t.is-cell .smmcfg-hd b')].map(x => x.textContent) }; });
  ok('новая основная — SR', D1.main.join() === 'SR', D1.main);
  ok('сетка при этом не перетасовывается', D1.cells.slice().sort().join() === ['Аудитория','Охват','Просмотры','Контент'].sort().join(), D1.cells);

  await page.evaluate(() => smmCfgMain('ER' && 'reach'));
  await page.waitForTimeout(160);
  const D2 = await page.evaluate(() => {
    const ov = document.getElementById('ov-smmcfg');
    return { main: [...ov.querySelectorAll('.smmcfg-t.is-main .smmcfg-hd b')].map(x => x.textContent),
      cells: [...ov.querySelectorAll('.smmcfg-t.is-cell .smmcfg-hd b')].map(x => x.textContent) }; });
  ok('метрика из сетки, ставшая основной, из сетки уходит', D2.main.join() === 'Охват' && D2.cells.indexOf('Охват') < 0, D2);
  ok('её место занимает прежняя основная', D2.cells.indexOf('SR') >= 0 && D2.cells.length === 4, D2.cells);

  await page.evaluate(() => { window.__toasts.length = 0; smmCfgCell('lr'); });
  await page.waitForTimeout(160);
  const D3 = await page.evaluate(() => ({ toasts: window.__toasts,
    cells: [...document.querySelectorAll('#ov-smmcfg .smmcfg-t.is-cell .smmcfg-hd b')].map(x => x.textContent) }));
  ok('пятую в сетку не пускает', D3.cells.length === 4 && D3.cells.indexOf('LR') < 0, D3.cells);
  ok('и объясняет почему', /четыре места/.test(D3.toasts[0] || ''), D3.toasts);

  const первая = await page.evaluate(() => [...document.querySelectorAll('#ov-smmcfg .smmcfg-t.is-cell .smmcfg-hd b')][0].textContent);
  await page.evaluate(() => { const k = [...document.querySelectorAll('#ov-smmcfg .smmcfg-t.is-cell')][0]
    .querySelector('.smmcfg-body').getAttribute('onclick').match(/'([^']+)'/)[1]; smmCfgCell(k); });
  await page.waitForTimeout(160);
  const D4 = await page.evaluate(() => ({ n: document.querySelectorAll('#ov-smmcfg .smmcfg-t.is-cell').length,
    counter: document.querySelector('#ov-smmcfg .smmcfg-lg b').textContent,
    warn: !!document.querySelector('#ov-smmcfg .smmcfg-lg b.warn'),
    apply: document.querySelector('#ov-smmcfg .pjq-fb .pri').className }));
  ok('снятая метрика уходит из сетки', D4.n === 3, D4.n);
  ok('счётчик показывает недобор', /3 из 4/.test(D4.counter) && D4.warn, D4);
  ok('«Применить» гаснет', /off/.test(D4.apply), D4.apply);
  await page.evaluate(() => { window.__toasts.length = 0; smmCfgApply(); });
  await page.waitForTimeout(200);
  ok('и не даёт применить неполный набор', await page.evaluate(() => document.getElementById('ov-smmcfg').classList.contains('on')));
  ok('с объяснением', /ровно четыре/.test(await page.evaluate(() => window.__toasts[0] || '')));

  await page.evaluate(() => smmCfgReset());
  await page.waitForTimeout(160);
  const D5 = await page.evaluate(() => ({ main: [...document.querySelectorAll('#ov-smmcfg .smmcfg-t.is-main .smmcfg-hd b')].map(x => x.textContent),
    n: document.querySelectorAll('#ov-smmcfg .smmcfg-t.is-cell').length }));
  ok('сброс возвращает исходную раскладку', D5.main.join() === 'ER' && D5.n === 4, D5);

  /* ═════════ E. применение доезжает до карточки ═════════ */
  console.log('\n[E] применение');
  await page.evaluate(() => { smmCfgMain('sr'); smmCfgCell('reach'); smmCfgCell('er'); });
  await page.waitForTimeout(160);
  await page.evaluate(() => smmCfgApply());
  await page.waitForTimeout(320);
  const E = await page.evaluate(() => {
    const c = window.__card('Artel');
    return { open: document.getElementById('ov-smmcfg').classList.contains('on'),
      hero: c.querySelector('.smm1-hero-top .k').textContent,
      heroV: c.querySelector('.smm1-hero-top .v').textContent,
      cells: [...c.querySelectorAll('.smm1-cell .k')].map(x => x.textContent),
      vals: [...c.querySelectorAll('.smm1-cell .v')].map(x => x.textContent),
      saved: JSON.parse(localStorage.getItem('pjh_smmcard_v1_AG') || 'null') }; });
  ok('окно закрылось', !E.open);
  ok('основная на карточке — SR', /Сохранения/.test(E.hero) && /SR/.test(E.hero), E.hero);
  ok('и её значение', E.heroV === '1,4%', E.heroV);
  ok('в сетке ровно четыре', E.cells.length === 4, E.cells);
  ok('охват из сетки ушёл, ER занял его место', E.cells.indexOf('Охват') < 0 && E.cells.indexOf('ER') >= 0, E.cells);
  ok('выбор сохранён', E.saved && E.saved.main === 'sr', E.saved);

  await page.evaluate(() => paintProjList());
  await page.waitForTimeout(250);
  const E2 = await page.evaluate(() => {
    const c = window.__card('Artel');
    return { hero: c.querySelector('.smm1-hero-top .k').textContent }; });
  ok('раскладка переживает перерисовку', /SR/.test(E2.hero), E2.hero);

  /* метрика, которой нет в отчёте, показывает прочерк, а не ноль */
  const E3 = await page.evaluate(() => {
    const c = window.__card('Полупустой отчёт');
    return { vals: [...c.querySelectorAll('.smm1-cell .v')].map(x => x.textContent),
      nodata: c.querySelectorAll('.smm1-cell.nodata').length,
      hero: c.querySelector('.smm1-hero-top .v').textContent }; });
  ok('пустая метрика — прочерк, а не ноль', E3.vals.indexOf('—') >= 0 && E3.vals.indexOf('0') < 0, E3.vals);
  ok('и такая ячейка помечена', E3.nodata > 0, E3.nodata);

  /* ═════════ F. цифры отчётов не тронуты ═════════ */
  console.log('\n[F] изоляция от отчётов');
  const F = await page.evaluate(() => ({ same: JSON.stringify(_smmLbAll) === window.__reportSnapshot,
    keys: Object.keys(localStorage).filter(k => /pjh_smmcard/.test(k)) }));
  ok('ни одно поле отчёта не изменилось', F.same);
  ok('настройка живёт только в своём ключе', F.keys.length === 1 && F.keys[0] === 'pjh_smmcard_v1_AG', F.keys);
  const F2 = await page.evaluate(() => {
    const src = [...document.querySelectorAll('script')].map(s => s.textContent).join('\n');
    return { bad: /er\s*\*\s*fol\s*\/\s*reach/.test(src), good: /er\s*\*\s*reach\s*\/\s*fol/.test(src) }; });
  ok('перевёрнутая формула ERR из «Отчётов» убрана', !F2.bad, F2);
  ok('и заменена правильной', F2.good, F2);

  /* ═════════ G. вёрстка ═════════ */
  console.log('\n[G] вёрстка');
  await page.evaluate(() => smmCfgOpen('p1'));
  await page.waitForTimeout(300);
  const G = await page.evaluate(() => {
    const m = document.querySelector('#ov-smmcfg .pjq'), g = m.querySelector('.smmcfg-grid');
    const t = [...g.querySelectorAll('.smmcfg-t')].map(x => Math.round(x.getBoundingClientRect().height));
    return { w: Math.round(m.getBoundingClientRect().width), h: Math.round(m.getBoundingClientRect().height), vh: window.innerHeight,
      cols: getComputedStyle(g).gridTemplateColumns.split(' ').length, tallest: Math.max(...t), shortest: Math.min(...t),
      rows: (() => { const by = {}; [...g.querySelectorAll('.smmcfg-t')].forEach(x => { const r = x.getBoundingClientRect();
        (by[Math.round(r.top)] = by[Math.round(r.top)] || []).push(Math.round(r.height)); });
        return Object.values(by).map(a => Math.max(...a) - Math.min(...a)); })() }; });
  ok('окно влезает в экран', G.h <= G.vh - 40, G);
  ok('плитки в две колонки', G.cols === 2, G.cols);
  ok('плитка не растягивается на весь экран', G.tallest < 200, G.tallest);
  ok('в каждом ряду плитки одной высоты', G.rows.every(d => d === 0), G.rows);
  await page.evaluate(() => smmCfgClose()); await page.waitForTimeout(200);

  await page.evaluate(() => pjcxOpen('p1'));
  await page.waitForTimeout(300);
  const G2 = await page.evaluate(() => {
    const m = document.querySelector('#ov-pjcx .pjq');
    const gs = m.querySelector('.pjd-hero-g svg');
    return { w: Math.round(m.getBoundingClientRect().width), h: Math.round(m.getBoundingClientRect().height), vh: window.innerHeight,
      gaugeW: gs ? Math.round(gs.getBoundingClientRect().width) : -1,
      over: [...m.querySelectorAll('.pjd-cr, .pjd-tr')].some(x => x.scrollWidth > x.clientWidth + 1),
      scroll: m.querySelector('.pjq-b').scrollHeight > m.querySelector('.pjq-b').clientHeight }; });
  ok('справочник влезает в экран', G2.h <= G2.vh - 40, G2);
  ok('гейдж не растянут на пол-окна', G2.gaugeW > 60 && G2.gaugeW <= 190, G2.gaugeW);
  ok('строки не переполняются', !G2.over);
  ok('длинный документ скроллится внутри', G2.scroll);

  console.log('\n[H] ошибки страницы');
  ok('нет ошибок JS', errs.length === 0, errs.slice(0, 4));

  console.log('\n' + (fail ? '✗' : '✓') + ' probe_pjx: ' + pass + ' пройдено, ' + fail + ' провалено');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
