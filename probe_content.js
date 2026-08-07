/* probe_content — модуль «Эффективность контента».

   Модуль отвечает на вопрос «что снимать дальше» по SMM-отчётам проектов.
   Цена ошибки здесь выше обычной: он не показывает данные, а выносит
   суждение, и неверное суждение выглядит ровно так же уверенно, как верное.
   Поэтому проверяем не отрисовку, а именно те места, где модуль может
   соврать:

   · свёртка копий. Отчёты копируют и правят копию, в базе остаются все
     версии. Без свёртки один май учитывается десять раз, и рубрика с одной
     публикацией получает n=10 — то есть право на первое место;
   · пересчёт ставок из счётчиков. Хранимым er/lr/tr/shr/sr доверять нельзя:
     в базе лежит рилс с 25 765 комментариями на охват 51 507 в старых копиях
     и с 257 в новых. Опечатку исправили, отчёты с ней остались;
   · проверка на вменяемость. Та же опечатка даёт ER 50,88 % — публикация
     обязана выйти из рейтинга, а не возглавить его;
   · сжатие рубрик к норме. Рубрика с одной публикацией не ранжируется вовсе;
     с двумя — место показывается диапазоном. Это то, чего нет ни у одного
     из тринадцати изученных мировых продуктов, и ломаться оно не должно;
   · нулевая межгрупповая дисперсия. Если рубрики статистически неразличимы,
     рейтинг не строится — «различий не обнаружено» правильный ответ, а не
     отказ инструмента;
   · каскад оценок масштаба. MAD обнуляется, когда у половины публикаций
     нулевые репосты; после него должен подхватывать IQR, потом SD;
   · каждый вывод — с доказательством, и цвет рубрики один во всех вкладках.

   Данные для проверок синтетические и подобраны так, чтобы у каждой
   величины был заранее посчитанный ответ. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };
const близко = (a, b, e) => a != null && Math.abs(a - b) < (e == null ? 1e-6 : e);

/* Публикация с заданными счётчиками. Ставки не задаём принципиально: модуль
   обязан считать их сам, и подсунутое сюда значение он должен игнорировать. */
const пуб = (o) => Object.assign({
  title: 'п', rubric: 'A', cover: '', link: '',
  views: 2000, reach: 1000, likes: 50, comments: 10, saves: 5, shares: 5, gain: 2
}, o || {});

const отчёт = (o) => Object.assign({
  id: 'r1', project_id: 'p1', title: 'Отчёт', published_at: '2026-07-01T00:00:00Z',
  payload: { period: 'МАЙ', posts: [], reels: [], metrics: {} }
}, o || {});

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  /* Модуль спрашивает список проектов у кабинета: agActiveProjects учитывает
     область видимости сотрудника и архив, и без входа в кабинет отдаёт пусто.
     Проба проверяет модуль, а не слой прав, поэтому подменяем источник на
     PROJECTS — сам список в каждой проверке задаём явно. */
  await page.evaluate(() => {
    window.agActiveProjects = function(){
      return (typeof PROJECTS !== 'undefined' && PROJECTS) ? PROJECTS.slice() : [];
    };
  });

  /* ─────────────────────────────────────────────────────────────────────── */
  console.log('[A] данные: свёртка копий, пустые отчёты, непокрытый контент');

  const A = await page.evaluate(({ пуб, отчёт }) => {
    const п = (o) => Object.assign({}, пуб, o || {});
    const о = (o) => Object.assign({}, отчёт, o || {});
    const общий = { period: 'МАЙ', reels: [п({ title: 'один' })], posts: [], metrics: {} };

    /* три копии одного периода: побеждать должна самая свежая */
    const копии = [
      о({ id: '1', title: 'Отчёт', published_at: '2026-07-01T00:00:00Z', payload: общий }),
      о({ id: '2', title: 'Отчёт · копия', published_at: '2026-07-02T00:00:00Z', payload: общий }),
      о({ id: '3', title: 'Отчёт · копия · копия', published_at: '2026-07-03T00:00:00Z',
          payload: { period: 'МАЙ', reels: [п({ title: 'свежий' })], posts: [], metrics: {} } })
    ];
    const d = ctDedupe(копии);

    /* два разных периода одного проекта не сворачиваются */
    const дваПериода = ctDedupe([
      о({ id: '1', payload: { period: 'МАЙ', reels: [], posts: [] } }),
      о({ id: '2', payload: { period: 'ИЮНЬ', reels: [], posts: [] } })
    ]);

    /* разные проекты не сворачиваются даже при одинаковом периоде */
    const дваПроекта = ctDedupe([
      о({ id: '1', project_id: 'p1' }), о({ id: '2', project_id: 'p2' })
    ]);

    return {
      осталось: d.kept.length, отброшено: d.dropped, победил: d.kept[0].id,
      названиеПобедителя: d.kept[0].payload.reels[0].title,
      база: ctBaseTitle('Отчёт для UD · копия · копия · копия'),
      периоды: дваПериода.kept.length,
      проекты: дваПроекта.kept.length,
      пустой: (() => { try { return ctBuild([о({ payload: {} })], {}).units.length; } catch (e) { return 'упал: ' + e.message; } })(),
      ничего: (() => { try { const s = ctBuild([], {});
        return { публикаций: s.units.length, находок: s.findings.length,
                 тип: (s.findings[0] || {}).type }; } catch (e) { return { упал: e.message }; } })(),
      безРубрики: (() => {
        const s = ctBuild([о({ payload: { period: 'X', reels: [п({ rubric: '' }), п({ rubric: 'A' }), п({ rubric: 'A' }), п({ rubric: 'A' })], posts: [] } })], {});
        return { есть: !!s.rubrics.uncovered, n: s.rubrics.uncovered ? s.rubrics.uncovered.n : 0,
                 вРейтинге: s.rubrics.ranked.filter(r => r.name === '').length };
      })()
    };
  }, { пуб: пуб(), отчёт: отчёт() });

  ok('три копии свёрнуты в одну', A.осталось === 1 && A.отброшено === 2, A);
  ok('побеждает самая свежая копия', A.победил === '3' && A.названиеПобедителя === 'свежий', A.победил);
  ok('хвост «· копия» срезается', A.база === 'отчёт для ud', A.база);
  ok('разные периоды не сворачиваются', A.периоды === 2, A.периоды);
  ok('разные проекты не сворачиваются', A.проекты === 2, A.проекты);
  ok('пустой payload не роняет сборку', A.пустой === 0, A.пустой);
  ok('полное отсутствие данных не роняет сборку', A.ничего.публикаций === 0, A.ничего);
  ok('на пустоте выдаётся ровно одна находка — о нехватке данных',
      A.ничего.находок === 1 && A.ничего.тип === 'данные', A.ничего);
  ok('публикация без рубрики попадает в непокрытые', A.безРубрики.есть && A.безРубрики.n === 1, A.безРубрики);
  ok('непокрытые не попадают в рейтинг рубрик', A.безРубрики.вРейтинге === 0, A.безРубрики);

  /* ─────────────────────────────────────────────────────────────────────── */
  console.log('[B] математика: ставки, масштаб, композит, сжатие');

  const B = await page.evaluate(({ пуб }) => {
    const п = (o) => Object.assign({}, пуб, o || {});
    /* Ставки считаются от счётчиков, а хранимое значение игнорируется:
       50 лайков на 1000 охвата — это 5 %, что бы ни лежало в поле er. */
    const r = ctRates(п({ er: 999, lr: 999 }));
    /* И то же самое через полную сборку: подмена «взять хранимое» живёт
       в ctUnits, а не в ctRates, и проверка обязана доставать до неё. */
    const черезСборку = ctBuild([{ id: 'r', project_id: 'p', title: 'о', published_at: '2026-07-01',
      payload: { period: 'X', posts: [], reels: [
        п({ title: 'подложное', er: 999, lr: 888, tr: 777, sr: 666, shr: 555 }),
        п({ rubric: 'B' }), п({ rubric: 'B' })] } }], {}).units[0];

    /* Каскад оценок масштаба. */
    const шкалы = {
      обычный: ctScale([1, 2, 3, 4, 5]).via,
      нулевойMAD: ctScale([0, 0, 0, 0, 5, 7]).via,
      безРазброса: ctScale([3, 3, 3, 3]).via,
      пусто: ctScale([]).via
    };

    /* Сжатие спрашиваем у модуля, а не считаем в проверке: формула,
       переписанная в тест, подтверждает арифметику автора, а не код.
       Рубрика D далеко от нормы и держится на двух публикациях — её
       сглаженное значение обязано уехать к норме, но не дойти до неё. */
    const сжатие = (() => {
      const s = ctBuild([{ id: 'r', project_id: 'p', title: 'о', published_at: '2026-07-01',
        payload: { period: 'X', posts: [], reels: [
          п({ rubric: 'N', likes: 50 }), п({ rubric: 'N', likes: 52 }), п({ rubric: 'N', likes: 48 }),
          п({ rubric: 'N', likes: 51 }), п({ rubric: 'N', likes: 49 }),
          п({ rubric: 'D', likes: 250 }), п({ rubric: 'D', likes: 240 })] } }], {});
      const d = s.rubrics.ranked.filter(r => r.name === 'D')[0];
      const n = s.rubrics.ranked.filter(r => r.name === 'N')[0];
      if (!d || !n) return null;
      return { сырое: d.raw, сглажено: d.shrunk, норма: s.rubrics.mu, B: d.B, n: d.n,
               m: s.rubrics.variance.m,
               междуСырымИНормой: (d.shrunk < d.raw) && (d.shrunk > s.rubrics.mu),
               ближеКНорме: Math.abs(d.shrunk - s.rubrics.mu) < Math.abs(d.raw - s.rubrics.mu),
               BпоФормуле: Math.abs(d.B - s.rubrics.variance.m / (d.n + s.rubrics.variance.m)) < 1e-9,
               слабееУБольшого: n.B < d.B };
    })();

    /* Лифт при равенстве норме обязан быть ровно единицей. */
    const одинаковые = ctBuild([{ id: 'r', project_id: 'p', title: 'о', published_at: '2026-07-01',
      payload: { period: 'X', posts: [], reels: [
        п({ rubric: 'A' }), п({ rubric: 'A' }), п({ rubric: 'A' }),
        п({ rubric: 'B' }), п({ rubric: 'B' }), п({ rubric: 'B' })] } }], {});

    /* Виральный выброс не должен вытеснить всё остальное: логистика ограничивает
       вклад сверху. Индекс выброса выше, но не в разы больше сотни. */
    const свыбросом = ctBuild([{ id: 'r', project_id: 'p', title: 'о', published_at: '2026-07-01',
      payload: { period: 'X', posts: [], reels: [
        п({ title: 'обычная1' }), п({ title: 'обычная2' }), п({ title: 'обычная3' }), п({ title: 'обычная4' }),
        п({ title: 'выброс', reach: 900000, views: 1500000, likes: 45000, comments: 9000, saves: 4500, shares: 4500 })] } }], {});
    const выброс = свыбросом.units.filter(u => u.title === 'выброс')[0];
    const обычная = свыбросом.units.filter(u => u.title === 'обычная1')[0];

    return {
      ставки: { lr: r.lr, tr: r.tr, sr: r.sr, shr: r.shr, er: r.er, fcr: r.fcr },
      erЕстьСумма: Math.abs(r.er - (r.lr + r.tr + r.sr + r.shr)) < 1e-9,
      шкалы: шкалы,
      сжатие: сжатие,
      лифты: одинаковые.rubrics.ranked.map(x => x.lift),
      выброс: выброс ? Math.round(выброс.score) : null,
      обычная: обычная ? Math.round(обычная.score) : null,
      сборка: { lr: черезСборку.lr, er: черезСборку.er, sr: черезСборку.sr,
                хранимое: черезСборку.stored ? черезСборку.stored.lr : null },
      весаСумма: Object.keys(CT_W).reduce((s, k) => s + CT_W[k], 0),
      безER: Object.keys(CT_W).indexOf('er') < 0,
      нольОхвата: (() => { const x = ctRates(п({ reach: 0 })); return x.er === null && x.lr === null; })()
    };
  }, { пуб: пуб() });

  ok('LR = лайки/охват', близко(B.ставки.lr, 5), B.ставки.lr);
  ok('C/R = комментарии/охват', близко(B.ставки.tr, 1), B.ставки.tr);
  ok('SR = сохранения/охват', близко(B.ставки.sr, 0.5), B.ставки.sr);
  ok('SH/R = репосты/охват', близко(B.ставки.shr, 0.5), B.ставки.shr);
  ok('ER = 7 % и равен сумме компонент', близко(B.ставки.er, 7) && B.erЕстьСумма, B.ставки.er);
  ok('FCR = подписки на 1000 охвата', близко(B.ставки.fcr, 2), B.ставки.fcr);
  ok('хранимая ставка игнорируется в ctRates', B.ставки.lr !== 999, B.ставки.lr);
  ok('и игнорируется при полной сборке публикации',
      близко(B.сборка.lr, 5) && близко(B.сборка.er, 7) && близко(B.сборка.sr, 0.5), B.сборка);
  ok('хранимое значение при этом сохранено для сверки', B.сборка.хранимое === 888, B.сборка);
  ok('нулевой охват не даёт деления на ноль', B.нольОхвата, B.нольОхвата);
  ok('масштаб: обычный набор через MAD', B.шкалы.обычный === 'MAD', B.шкалы);
  ok('масштаб: нулевой MAD подхватывает IQR', B.шкалы.нулевойMAD === 'IQR', B.шкалы);
  ok('масштаб: без разброса компонента отключается', B.шкалы.безРазброса === 'нет разброса', B.шкалы);
  ok('масштаб: пустой набор не падает', B.шкалы.пусто === 'нет данных', B.шкалы);
  ok('сглаженное значение отличается от сырого', B.сжатие && B.сжатие.сглажено !== B.сжатие.сырое, B.сжатие);
  ok('и лежит между сырым и нормой профиля', B.сжатие && B.сжатие.междуСырымИНормой, B.сжатие);
  ok('оно ближе к норме, чем сырое', B.сжатие && B.сжатие.ближеКНорме, B.сжатие);
  ok('доля сжатия равна m/(n+m)', B.сжатие && B.сжатие.BпоФормуле, B.сжатие);
  ok('рубрику с большим n тянет к норме слабее', B.сжатие && B.сжатие.слабееУБольшого, B.сжатие);
  ok('лифт при равенстве норме равен единице', B.лифты.length === 2 && B.лифты.every(l => близко(l, 1, 0.01)), B.лифты);
  ok('веса композита в сумме дают единицу', близко(B.весаСумма, 1, 1e-9), B.весаСумма);
  ok('ER в композит не входит — иначе двойной счёт', B.безER);
  ok('виральный выброс получает индекс выше обычной', B.выброс > B.обычная, [B.выброс, B.обычная]);
  ok('но не улетает за пределы шкалы', B.выброс <= 100, B.выброс);

  /* ─────────────────────────────────────────────────────────────────────── */
  console.log('[C] правила показа: малое n, вменяемость, неразличимость');

  const C = await page.evaluate(({ пуб }) => {
    const п = (o) => Object.assign({}, пуб, o || {});
    const собрать = (reels) => ctBuild([{ id: 'r', project_id: 'p', title: 'о',
      published_at: '2026-07-01', payload: { period: 'X', posts: [], reels: reels } }], {});

    /* Рубрика с одной публикацией не должна ранжироваться, даже если эта
       публикация виральная — иначе весь смысл сжатия теряется. */
    const однаВиральная = собрать([
      п({ rubric: 'ОДНА', reach: 100000, views: 220000, likes: 20000, comments: 4000, saves: 2000, shares: 2000 }),
      п({ rubric: 'B' }), п({ rubric: 'B' }), п({ rubric: 'B' }),
      п({ rubric: 'C', likes: 20 }), п({ rubric: 'C', likes: 30 }), п({ rubric: 'C', likes: 25 })
    ]);

    /* Настоящая опечатка из базы: 25 765 комментариев на охват 51 507. */
    const опечатка = собрать([
      п({ title: 'опечатка', rubric: 'ИГРОВОЙ', reach: 51507, views: 57502, likes: 384, comments: 25765, saves: 13, shares: 45 }),
      п({ rubric: 'B' }), п({ rubric: 'B' }), п({ rubric: 'B' })
    ]);
    const плохая = опечатка.units.filter(u => u.title === 'опечатка')[0];

    /* Две публикации — ранг диапазоном, но верх диапазона не может выйти за
       число рубрик в рейтинге. Берём четыре рубрики, чтобы у той, что с двумя
       публикациями, был запас снизу, и отдельно проверяем последнюю. */
    const две = собрать([
      п({ rubric: 'A', likes: 200 }), п({ rubric: 'A', likes: 210 }),
      п({ rubric: 'B', likes: 100 }), п({ rubric: 'B', likes: 110 }), п({ rubric: 'B', likes: 105 }),
      п({ rubric: 'C', likes: 60 }), п({ rubric: 'C', likes: 65 }), п({ rubric: 'C', likes: 62 }),
      п({ rubric: 'D', likes: 20 }), п({ rubric: 'D', likes: 22 }), п({ rubric: 'D', likes: 21 })]);

    return {
      одна: {
        вРейтинге: однаВиральная.rubrics.ranked.filter(r => r.name === 'ОДНА').length,
        вМалых: однaВМалых(однаВиральная),
        сырое: (однаВиральная.rubrics.lowN.filter(r => r.name === 'ОДНА')[0] || {}).raw != null
      },
      опечатка: {
        ok: plокОпечатки(плохая), нарушения: плохая ? плохая.issues.map(i => i.id) : null,
        безИндекса: плохая ? плохая.score === null : null,
        неВРубрике: опечатка.rubrics.ranked.concat(опечатка.rubrics.lowN)
          .filter(r => r.name === 'ИГРОВОЙ').length
      },
      диапазон: (две.rubrics.ranked.filter(r => r.n === 2)[0] || {}).rankRange,
      верхДиапазона: (две.rubrics.ranked.filter(r => r.n === 2)[0] || {}).rankTo,
      всегоВРейтинге: две.rubrics.ranked.length,
      верхНеВышелЗаСписок: две.rubrics.ranked.every(r => r.rankTo <= две.rubrics.ranked.length),
      последняяБезДиапазона: (две.rubrics.ranked[две.rubrics.ranked.length - 1] || {}).rankRange !== true,
      триБезДиапазона: (две.rubrics.ranked.filter(r => r.n === 3)[0] || {}).rankRange,
      неразличимы: (() => {
        /* все рубрики из одинаковых публикаций — различий быть не может */
        const s = собрать([п({ rubric: 'A' }), п({ rubric: 'A' }), п({ rubric: 'A' }),
                           п({ rubric: 'B' }), п({ rubric: 'B' }), п({ rubric: 'B' })]);
        return s.rubrics.indistinguishable;
      })(),
      mВПределах: (() => {
        const s = собрать([п({ rubric: 'A' }), п({ rubric: 'A', likes: 900 }), п({ rubric: 'B' }),
                           п({ rubric: 'B', likes: 5 }), п({ rubric: 'C' }), п({ rubric: 'C', likes: 300 })]);
        return s.rubrics.variance.m >= 1 && s.rubrics.variance.m <= 10;
      })()
    };
    function однaВМалых(s) { return s.rubrics.lowN.filter(r => r.name === 'ОДНА').length; }
    function plокОпечатки(u) { return u ? u.ok : null; }
  }, { пуб: пуб() });

  ok('рубрика с одной публикацией не ранжируется', C.одна.вРейтинге === 0, C.одна);
  ok('она уходит в блок «недостаточно данных»', C.одна.вМалых === 1, C.одна);
  ok('сырое значение при этом показано', C.одна.сырое, C.одна);
  ok('опечатка «25 765 комментариев» ловится', C.опечатка.ok === false, C.опечатка);
  ok('и ловится обоими правилами', C.опечатка.нарушения.indexOf('comments_gt_likes') >= 0
      && C.опечатка.нарушения.indexOf('rate_over_30') >= 0, C.опечатка.нарушения);
  ok('такая публикация индекса не получает', C.опечатка.безИндекса, C.опечатка);
  ok('и не создаёт рубрику в рейтинге', C.опечатка.неВРубрике === 0, C.опечатка);
  ok('при n=2 место показывается диапазоном', C.диапазон === true, C);
  ok('верх диапазона не выходит за число рубрик в рейтинге', C.верхНеВышелЗаСписок, C);
  ok('последняя рубрика диапазоном не показывается', C.последняяБезДиапазона, C);
  ok('при n=3 диапазон не нужен', C.триБезДиапазона === false, C.триБезДиапазона);
  ok('одинаковые рубрики признаются неразличимыми', C.неразличимы === true, C.неразличимы);
  ok('константа сжатия зажата в [1,10]', C.mВПределах, C.mВПределах);

  /* ─────────────────────────────────────────────────────────────────────── */
  console.log('[D] интерфейс: вкладки, цвет рубрики, карточка, пустые состояния');

  const D = await page.evaluate(({ пуб }) => {
    const п = (o) => Object.assign({}, пуб, o || {});
    const реалы = [];
    for (let i = 0; i < 8; i++) реалы.push(п({
      title: 'ролик ' + (i + 1), rubric: ['A', 'A', 'A', 'B', 'B', 'B', 'C', 'D'][i],
      reach: 1000 * (i + 1), views: 2200 * (i + 1),
      likes: 40 + i * 12, comments: 8 + i * 3, saves: 4 + i, shares: 3 + i, gain: 1 + i,
      cover: i % 2 ? 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' : ''
    }));
    if (typeof PROJECTS !== 'undefined' && !PROJECTS.filter(p => String(p.id) === 'p1').length) PROJECTS.push({ id: 'p1', name: 'Тест' });
    CT_RAW = [{ id: 'r1', project_id: 'p1', title: 'Отчёт', published_at: '2026-07-01T00:00:00Z',
      payload: { period: 'МАЙ', posts: [], reels: реалы, metrics: { followers: 40 } } }];
    CT_SIG = ctSig();   // кэш принадлежит этому набору проектов, иначе он будет стёрт как чужой

    const цветаНаВкладке = () => {
      const м = {};
      document.querySelectorAll('#content-ag [style*="--c:"]').forEach(e => {
        const n = (e.querySelector('.cfx-rubn b') || e.querySelector('.cfx-rub') || {}).textContent;
        const c = (e.getAttribute('style').match(/--c:\s*([^;]+)/) || [])[1];
        if (n && c) м[n.trim()] = c.trim();
      });
      return м;
    };

    CT.tab = 'content'; renderContentFx();
    const контент = {
      вкладок: document.querySelectorAll('#content-ag .team-tab').length,
      активна: (document.querySelector('#content-ag .team-tab.on') || {}).textContent,
      честность: !!document.querySelector('#content-ag .cfx-honest'),
      плиток: document.querySelectorAll('#content-ag .cfx-kpi').length,
      диаграмма: document.querySelectorAll('#content-ag .cfx-pt').length,
      карточек: document.querySelectorAll('#content-ag .cfx-grid .cfx-cardu').length,
      бейджей: document.querySelectorAll('#content-ag .cfx-grid .cfx-rank').length,
      метрикНаКарточке: document.querySelectorAll('#content-ag .cfx-grid .cfx-cardu:first-child .cfx-mets span').length,
      заглушек: document.querySelectorAll('#content-ag .cfx-noimg').length,
      топАнтитоп: document.querySelectorAll('#content-ag .cfx-tb .card').length,
      цвета: цветаНаВкладке()
    };

    CT.tab = 'rubrics'; renderContentFx();
    const рубрики = {
      карточек: document.querySelectorAll('#content-ag .card.cfx-rub').length,
      сN: Array.from(document.querySelectorAll('#content-ag .cfx-rubn span')).map(e => e.textContent),
      бейджиДоверия: document.querySelectorAll('#content-ag .cfx-rubh .cfx-badge').length,
      сырое: document.querySelectorAll('#content-ag .cfx-rubv .raw').length,
      малые: document.querySelectorAll('#content-ag .cfx-lowc').length,
      матрица: !!document.querySelector('#content-ag .cfx-mx'),
      цвета: цветаНаВкладке()
    };

    CT.tab = 'findings'; renderContentFx();
    const выводы = {
      находок: document.querySelectorAll('#content-ag .card.cfx-find').length,
      сДоказательством: document.querySelectorAll('#content-ag .card.cfx-find .cfx-block .cfx-lbl').length,
      сРекомендацией: document.querySelectorAll('#content-ag .card.cfx-find .cfx-block.ac').length,
      уверенность: Array.from(document.querySelectorAll('#content-ag .cfx-fh .cfx-badge')).map(e => e.textContent),
      миниатюр: document.querySelectorAll('#content-ag .cfx-ev').length
    };

    /* Карточка публикации: пять разделов и веса на виду. */
    CT.tab = 'content'; renderContentFx();
    const первая = document.querySelector('#content-ag .cfx-grid .cfx-cardu');
    let модалка = null;
    if (первая) {
      первая.click();
      const м = document.querySelector('.cfx-modal');
      if (м) модалка = {
        разделов: м.querySelectorAll('.cfx-msec').length,
        подписи: Array.from(м.querySelectorAll('.cfx-msec .cfx-lbl')).map(e => e.textContent),
        весаВидны: /веса:/.test(м.textContent),
        перцентиль: /выше \d+ % публикаций/.test(м.textContent),
        проСсылку: /Ссылка не заполнена/.test(м.textContent)
      };
      if (typeof pd2Close === 'function') pd2Close();
    }

    /* Пустое состояние: ни одного отчёта. */
    const было = CT_RAW;
    CT_RAW = []; CT_SIG = ctSig();
    CT.tab = 'content'; renderContentFx();
    const пусто = { есть: !!document.querySelector('#content-ag .cfx-empty'),
                    текст: (document.querySelector('#content-ag .cfx-empty b') || {}).textContent };
    CT.tab = 'rubrics'; renderContentFx();
    const пустоР = !!document.querySelector('#content-ag .cfx-empty');
    CT.tab = 'findings'; renderContentFx();
    /* На выводах пустоты быть не должно: отсутствие данных — само по себе
       вывод, и он полезнее пустого экрана. */
    const пустоВ = { пусто: !!document.querySelector('#content-ag .cfx-empty'),
      находок: document.querySelectorAll('#content-ag .card.cfx-find').length,
      проДанные: /Данных не хватает/.test(document.getElementById('content-ag').textContent) };
    CT_RAW = было; CT_SIG = ctSig(); CT.tab = 'content'; renderContentFx();

    return { контент, рубрики, выводы, модалка, пусто, пустоР, пустоВ,
             вРеестре: AG_MODULES.content || null };
  }, { пуб: пуб() });

  ok('модуль заведён в реестре', D.вРеестре === 'Эффективность контента', D.вРеестре);
  ok('три вкладки', D.контент.вкладок === 3, D.контент.вкладок);
  ok('строка честности данных на экране', D.контент.честность);
  ok('четыре плитки итога, не больше', D.контент.плиток === 4, D.контент.плиток);
  ok('диаграмма рисует все публикации', D.контент.диаграмма === 8, D.контент.диаграмма);
  ok('сетка рисует все публикации', D.контент.карточек === 8, D.контент.карточек);
  ok('у каждой карточки ранговый бейдж', D.контент.бейджей === 8, D.контент.бейджей);
  ok('на карточке ровно четыре метрики', D.контент.метрикНаКарточке === 4, D.контент.метрикНаКарточке);
  ok('без обложки рисуется заглушка, а не битая картинка', D.контент.заглушек > 0, D.контент.заглушек);
  ok('топ и антитоп стоят рядом', D.контент.топАнтитоп === 2, D.контент.топАнтитоп);
  ok('рубрики нарисованы карточками', D.рубрики.карточек >= 2, D.рубрики.карточек);
  ok('у каждой рубрики видно n', D.рубрики.сN.length === D.рубрики.карточек
      && D.рубрики.сN.every(t => /публикац/.test(t)), D.рубрики.сN);
  ok('у каждой рубрики бейдж доверия', D.рубрики.бейджиДоверия === D.рубрики.карточек, D.рубрики);
  ok('сырое значение показано рядом со сглаженным', D.рубрики.сырое === D.рубрики.карточек, D.рубрики.сырое);
  ok('рубрики с одной публикацией в отдельном блоке', D.рубрики.малые >= 1, D.рубрики.малые);
  ok('матрица «рубрика × метрика» построена', D.рубрики.матрица);
  ok('цвет рубрики одинаков на обеих вкладках', (() => {
    const a = D.контент.цвета, b = D.рубрики.цвета;
    const общие = Object.keys(a).filter(k => b[k]);
    return общие.length > 0 && общие.every(k => a[k] === b[k]);
  })(), [D.контент.цвета, D.рубрики.цвета]);
  ok('выводы выданы', D.выводы.находок >= 3, D.выводы.находок);
  ok('у каждой находки доказательство и рекомендация',
      D.выводы.сРекомендацией === D.выводы.находок && D.выводы.сДоказательством === D.выводы.находок * 2,
      D.выводы);
  ok('у каждой находки помечена уверенность', D.выводы.уверенность.length === D.выводы.находок
      && D.выводы.уверенность.every(t => /подтверждено|вероятно|предварительно/.test(t)), D.выводы.уверенность);
  ok('есть находки с кликабельными миниатюрами', D.выводы.миниатюр > 0, D.выводы.миниатюр);
  ok('карточка публикации открывается', !!D.модалка, D.модалка);
  ok('в карточке четыре смысловых раздела', D.модалка && D.модалка.разделов === 4, D.модалка && D.модалка.подписи);
  ok('разделы названы по целям, а не по типам метрик',
      D.модалка && JSON.stringify(D.модалка.подписи) === JSON.stringify(['Охват', 'Вовлечение', 'Рост', 'Оценка']),
      D.модалка && D.модалка.подписи);
  ok('веса индекса показаны человеку', D.модалка && D.модалка.весаВидны, D.модалка);
  ok('метрика показана вместе со своим местом в распределении', D.модалка && D.модалка.перцентиль, D.модалка);
  ok('отсутствие ссылки названо словами', D.модалка && D.модалка.проСсылку, D.модалка);
  ok('пустое состояние нарисовано на контенте и рубриках', D.пусто.есть && D.пустоР, [D.пусто, D.пустоР]);
  ok('на выводах вместо пустоты — находка о нехватке данных',
      !D.пустоВ.пусто && D.пустоВ.находок === 1 && D.пустоВ.проДанные, D.пустоВ);
  ok('пустое состояние объясняет, а не молчит', /Публикаций нет/.test(D.пусто.текст || ''), D.пусто.текст);


  /* ─────────────────────────────────────────────────────────────────────── */
  console.log('[F] изоляция агентств: кэш не переживает смену кабинета');

  const F = await page.evaluate(({ пуб }) => {
    const п = (o) => Object.assign({}, пуб, o || {});
    const отчёт = (pid, title) => ({ id: 'r-' + pid, project_id: pid, title: title,
      published_at: '2026-07-01T00:00:00Z',
      payload: { period: 'МАЙ', posts: [], reels: [
        п({ title: title + ' 1' }), п({ title: title + ' 2' }), п({ title: title + ' 3' })] } });

    /* Агентство А: два проекта, отчёты по обоим. */
    PROJECTS.length = 0;
    PROJECTS.push({ id: 'A1', name: 'А-один' }, { id: 'A2', name: 'А-два' });
    CT_RAW = [отчёт('A1', 'Альфа'), отчёт('A2', 'Бета')];
    CT_SIG = ctSig();
    CT.project = ''; CT.tab = 'content'; renderContentFx();
    const всеПрофили = ctState().units.length;
    CT.project = 'A1'; renderContentFx();          // фильтр профиля должен сужать
    const было = { публикаций: всеПрофили, одинПрофиль: ctState().units.length,
                   отпечаток: CT_SIG, фильтрПрофиля: CT.project,
                   текст: document.getElementById('content-ag').textContent };

    /* Переход в агентство Б. Кабинет подменяет список проектов; кэш модуля
       от прошлого входа остаётся в памяти. */
    PROJECTS.length = 0;
    PROJECTS.push({ id: 'B1', name: 'Б-один' });
    const устарел = ctStale();
    renderContentFx();
    const после = {
      кэш: CT_RAW,
      отпечаток: CT_SIG,
      фильтрПрофиля: CT.project,
      публикаций: ctState().units.length,
      текстБезЧужого: document.getElementById('content-ag').textContent.indexOf('Альфа') < 0
        && document.getElementById('content-ag').textContent.indexOf('Бета') < 0
    };

    /* Второй рубеж: даже если отпечаток промахнётся и в кэше окажется чужая
       строка, до сборки она дойти не должна. */
    CT_RAW = [отчёт('A1', 'Альфа'), отчёт('B1', 'Гамма')];
    CT_SIG = ctSig();
    const рубеж = {
      публикаций: ctState().units.length,
      названия: ctState().units.map(u => u.title).join(' ')
    };

    /* Возврат в исходное состояние, чтобы не мешать остальным проверкам. */
    PROJECTS.length = 0; PROJECTS.push({ id: 'p1', name: 'Тест' });
    ctReset();
    return { было, устарел, после, рубеж };
  }, { пуб: пуб() });

  ok('в своём агентстве видны все публикации', F.было.публикаций === 6, F.было);
  ok('фильтр профиля сужает до одного проекта', F.было.одинПрофиль === 3, F.было);
  ok('смена набора проектов помечается как устаревание', F.устарел === true, F.устарел);
  ok('кэш прошлого агентства сбрасывается', F.после.кэш === null, F.после.кэш && F.после.кэш.length);
  ok('фильтр профиля прошлого агентства сбрасывается', F.после.фильтрПрофиля === '', F.после.фильтрПрофиля);
  ok('до загрузки нового агентства публикаций ноль', F.после.публикаций === 0, F.после.публикаций);
  ok('чужие названия на экран не попадают', F.после.текстБезЧужого, F.после);
  ok('чужая строка в кэше отсеивается на сборке', F.рубеж.публикаций === 3, F.рубеж);
  ok('и остаются только свои публикации', F.рубеж.названия.indexOf('Альфа') < 0
      && F.рубеж.названия.indexOf('Гамма') >= 0, F.рубеж.названия);


  /* Загрузку проверяем отдельно: именно в ней живёт отпечаток, и подложенный
     руками кэш до неё не достаёт. Подменяем клиента базы заглушкой — проба
     смотрит на поведение модуля, а не на сеть. */
  const F2 = await page.evaluate(async ({ пуб }) => {
    const п = (o) => Object.assign({}, пуб, o || {});
    const запросы = [];
    const было = window.SB;
    window.SB = { from: (таблица) => ({
      select: () => ({ eq: (поле, знач) => ({ in: (поле2, ids) => ({
        order: async () => { запросы.push({ таблица, знач, ids: ids.slice() });
          return { data: ids.map((id,i)=>({ id:'r'+i, project_id:id, title:'о',
            published_at:'2026-07-01T00:00:00Z',
            payload:{ period:'МАЙ', posts:[], reels:[п(),п(),п()] } })), error: null }; }
      }) }) })
    }) };

    PROJECTS.length = 0; PROJECTS.push({ id: 'X1', name: 'икс' });
    ctReset();
    await ctLoad();
    const первая = { отпечаток: CT_SIG, устарел: ctStale(), строк: (CT_RAW||[]).length,
                     спросили: запросы[0] ? запросы[0].ids : null };

    PROJECTS.length = 0; PROJECTS.push({ id: 'Y1', name: 'игрек' }, { id: 'Y2', name: 'игрек-два' });
    const послеСмены = { устарел: ctStale(), отпечатокСтарый: CT_SIG };
    await ctLoad();
    const вторая = { отпечаток: CT_SIG, устарел: ctStale(),
                     спросили: запросы[1] ? запросы[1].ids : null };

    window.SB = было;
    PROJECTS.length = 0; PROJECTS.push({ id: 'p1', name: 'Тест' });
    ctReset();
    return { первая, послеСмены, вторая, запросов: запросы.length };
  }, { пуб: пуб() });

  ok('загрузка спрашивает только проекты своего агентства',
      JSON.stringify(F2.первая.спросили) === JSON.stringify(['X1']), F2.первая);
  ok('после загрузки кэш помечен отпечатком набора', F2.первая.отпечаток === 'X1', F2.первая);
  ok('свежий кэш устаревшим не считается', F2.первая.устарел === false, F2.первая);
  ok('смена набора проектов делает кэш устаревшим', F2.послеСмены.устарел === true, F2.послеСмены);
  ok('повторная загрузка спрашивает уже новый набор',
      JSON.stringify(F2.вторая.спросили) === JSON.stringify(['Y1', 'Y2']), F2.вторая);
  ok('и отпечаток обновляется', F2.вторая.отпечаток === 'Y1,Y2' && F2.вторая.устарел === false, F2.вторая);


  /* ─────────────────────────────────────────────────────────────────────── */
  console.log('[G] ряд управления: списки, а не три ряда кнопок');

  const G = await page.evaluate(({ пуб }) => {
    const п = (o) => Object.assign({}, пуб, o || {});
    const отчёт = (pid, per, t) => ({ id: 'r-' + pid + per, project_id: pid, title: 'о',
      published_at: '2026-07-01T00:00:00Z',
      payload: { period: per, posts: [], reels: [п({ title: t }), п({ title: t + '2' }), п({ title: t + '3' })] } });
    PROJECTS.length = 0;
    PROJECTS.push({ id: 'P1', name: 'Первый' }, { id: 'P2', name: 'Второй' });
    CT_RAW = [отчёт('P1', 'МАЙ', 'а'), отчёт('P2', 'ИЮНЬ', 'б')];
    CT_SIG = ctSig(); CT.project = ''; CT.period = ''; CT.kind = 'all';
    CT.tab = 'content'; renderContentFx();

    /* Меряем только на показанном кабинете: на скрытом все прямоугольники
       нулевые, и проверка «стоят в одну строку» проходила бы на пустом месте. */
    const _login = document.getElementById('page-login');
    const _app = document.getElementById('app-ag');
    const _былСкрыт = _login ? _login.classList.contains('hidden') : true;
    const _былВключён = _app ? _app.classList.contains('on') : true;
    if(_login) _login.classList.add('hidden');
    if(_app) _app.classList.add('on');

    const бар = document.querySelector('#content-ag .cfx-bar');
    const списки = бар ? [].slice.call(бар.querySelectorAll('.cfx-dd')) : [];
    /* Одного «одинакового верха» мало: если списки схлопнутся в нулевую
       ширину, верх у них тоже совпадёт, и проверка пройдёт на пустом месте.
       Смотрим ещё ширину и то, что они идут слева направо. */
    const короб = списки.map(d => d.getBoundingClientRect());
    const верх = короб.map(r => Math.round(r.top));
    const ширины = короб.map(r => Math.round(r.width));
    const слеваНаправо = короб.every((r, i) => i === 0 || r.left > короб[i-1].left);

    /* Выбор в списке обязан менять состояние, а не только подпись. */
    const кнопка = списки[0].querySelector('.dd-menu .dd-opt:nth-child(2)');
    кнопка.click();
    const послеВыбора = { проект: CT.project, публикаций: ctState().units.length,
      подпись: (document.querySelector('#content-ag .cfx-dd .dd-v') || {}).textContent,
      подсвечен: !!document.querySelector('#content-ag .cfx-dd.picked') };

    ctPick('project', '');
    const сброшено = !document.querySelector('#content-ag .cfx-dd.picked');

    /* Открытое меню уносится порталом в body; перерисовка не должна оставить
       его сиротой поверх экрана. */
    selToggle('cfx-period');
    const открыто = !!document.querySelector('body > .dd-menu.dd-portal');
    renderContentFx();
    const осиротело = !!document.querySelector('body > .dd-menu.dd-portal');

    if(_login && !_былСкрыт) _login.classList.remove('hidden');
    if(_app && !_былВключён) _app.classList.remove('on');

    return {
      рядов: бар ? 1 : 0,
      списков: списки.length,
      вОдномРяду: верх.length > 1 && верх.every(v => v === верх[0]),
      ширины: ширины, слеваНаправо: слеваНаправо,
      подписейРядов: document.querySelectorAll('#content-ag .cfx-flbl').length,
      лид: document.querySelectorAll('#content-ag .cfx-lead').length,
      порог: !!бар.querySelector('.cfx-tog'),
      послеВыбора, сброшено, открыто, осиротело,
      высота: бар ? Math.round(бар.getBoundingClientRect().height) : null
    };
  }, { пуб: пуб() });

  ok('ряд управления один', G.рядов === 1, G);
  ok('три выпадающих списка', G.списков === 3, G.списков);
  ok('и все стоят в одну строку', G.вОдномРяду, G);
  ok('каждый список видим и имеет ширину', G.ширины.every(w => w >= 90), G.ширины);
  ok('и они идут слева направо, а не друг под другом', G.слеваНаправо, G);
  ok('ряд не выше одной строки контролов', G.высота != null && G.высота <= 46, G.высота);
  ok('подписей рядов не осталось', G.подписейРядов === 0, G.подписейРядов);
  ok('вводной строки не осталось', G.лид === 0, G.лид);
  ok('порог зрелости остался переключателем', G.порог, G.порог);
  ok('выбор в списке меняет состояние модуля', G.послеВыбора.проект === 'P1', G.послеВыбора);
  ok('и сужает выборку', G.послеВыбора.публикаций === 3, G.послеВыбора);
  ok('подпись кнопки показывает выбранное', G.послеВыбора.подпись === 'Первый', G.послеВыбора);
  ok('включённый фильтр виден, не открывая список', G.послеВыбора.подсвечен, G.послеВыбора);
  ok('сброс снимает подсветку', G.сброшено, G.сброшено);
  ok('меню действительно уходит в портал', G.открыто, G);
  ok('перерисовка не оставляет меню сиротой', !G.осиротело, G);


  /* ─────────────────────────────────────────────────────────────────────── */
  console.log('[H] имена классов модуля никому не мешают');

  /* Префикс ct- в кабинете уже занят: кнопка контактов носит класс ct-chip,
     и правило модуля .ct-chip{height:38px} ломало ей высоту в панели вкладок
     проекта — вкладки переставали быть одной строкой. Проверка следит, чтобы
     ни один класс модуля не встречался в остальном файле. */
  const H = await page.evaluate(async () => {
    const текст = await (await fetch('/index.html')).text();
    const iC = текст.indexOf('##CT-CSS-START##'), jC = текст.indexOf('##CT-CSS-END##');
    const iJ = текст.indexOf('##CT-JS-START##'), jJ = текст.indexOf('##CT-JS-END##');
    if (iC < 0 || iJ < 0) return { ошибка: 'блоки модуля не найдены' };
    const свой = текст.slice(iC, jC);
    const чужое = текст.slice(0, iC) + текст.slice(jC, iJ) + текст.slice(jJ);

    /* Компоненты кабинета, которые модуль оформляет намеренно. Всё остальное
       с дефисом в имени обязано носить его собственный префикс. */
    const общие = ['card', 'card-h', 'card-body', 'dd-btn', 'dd-menu', 'dd-opt', 'dd-v',
      'modal-h', 'modal-b', 'modal-f', 'btn-add', 'btn-ghost', 'team-tab', 'team-tabs',
      'tabs-row', 'dd-portal'];

    /* Только составные имена: односложные (on, in, v, l) в правилах модуля
       всегда стоят вложенными и владельцем ничего не считают. */
    const все = Array.from(new Set((свой.match(/\.[a-z][a-z0-9]*(?:-[a-z0-9]+)+/g) || [])
      .map(s => s.slice(1))));
    const мои = все.filter(c => общие.indexOf(c) < 0);
    const столкновения = мои.filter(c => {
      const re = new RegExp('class="[^"]*\\b' + c + '\\b|\\.' + c + '\\b');
      return re.test(чужое);
    });
    return { классов: мои.length, столкновения: столкновения,
             безПрефикса: мои.filter(c => c.indexOf('cfx-') !== 0) };
  });

  ok('классы модуля вообще нашлись', H.классов > 40, H);
  ok('ни один класс модуля не встречается в остальном кабинете',
      H.столкновения && H.столкновения.length === 0, H.столкновения);
  ok('все собственные классы носят префикс модуля', H.безПрефикса && H.безПрефикса.length === 0, H.безПрефикса);


  /* ─────────────────────────────────────────────────────────────────────── */
  console.log('[I] сортировка: просмотры, акцент и колонки таблицы');

  const I = await page.evaluate(({ пуб }) => {
    const п = (o) => Object.assign({}, пуб, o || {});
    const рилсы = [];
    for (let i = 0; i < 6; i++) рилсы.push(п({
      title: 'ролик ' + (i + 1), rubric: i % 2 ? 'A' : 'B',
      reach: 1000 * (i + 1), views: 9000 - i * 700,      // просмотры намеренно против охвата
      likes: 40 + i * 9, comments: 6 + i * 2, saves: 3 + i, shares: 2 + i, gain: 1 + i }));
    PROJECTS.length = 0; PROJECTS.push({ id: 'p1', name: 'Тест' });
    CT_RAW = [{ id: 'r1', project_id: 'p1', title: 'о', published_at: '2026-07-01T00:00:00Z',
      payload: { period: 'МАЙ', posts: [], reels: рилсы } }];
    CT_SIG = ctSig(); CT.project = ''; CT.period = ''; CT.kind = 'all'; CT.tab = 'content';

    /* Замеры колонок имеют смысл только на показанном кабинете: на скрытом
       все прямоугольники нулевые и любое сравнение краёв сходится само. */
    const _login = document.getElementById('page-login');
    const _app = document.getElementById('app-ag');
    const _былСкрыт = _login ? _login.classList.contains('hidden') : true;
    const _былВключён = _app ? _app.classList.contains('on') : true;
    if(_login) _login.classList.add('hidden');
    if(_app) _app.classList.add('on');

    const чипы = () => [].slice.call(document.querySelectorAll('#content-ag .cfx-ctrls .cfx-chip'))
      .map(b => b.textContent);

    CT.sort = 'score'; CT.view = 'tiles'; renderContentFx();
    const поИндексу = {
      чипы: чипы(),
      перваяМетрика: (document.querySelector('#content-ag .cfx-grid .cfx-mets span i') || {}).textContent,
      акцентов: document.querySelectorAll('#content-ag .cfx-grid .cfx-cardu:first-child .cfx-mets span.on').length,
      метрик: document.querySelectorAll('#content-ag .cfx-grid .cfx-cardu:first-child .cfx-mets span').length
    };

    CT.sort = 'views'; renderContentFx();
    const карт = [].slice.call(document.querySelectorAll('#content-ag .cfx-grid .cfx-cardu'));
    const поПросмотрам = {
      перваяМетрика: (карт[0].querySelector('.cfx-mets span i') || {}).textContent,
      перваяЗначение: (карт[0].querySelector('.cfx-mets span b') || {}).textContent,
      акцентНаПервой: карт[0].querySelector('.cfx-mets span').classList.contains('on'),
      значение: карт[0].querySelector('.cfx-mets span').textContent,
      порядок: карт.map(c => (c.querySelector('.cfx-title') || {}).textContent)
    };

    CT.view = 'table'; renderContentFx();
    const таб = document.querySelector('#content-ag .cfx-list');
    const шапка = [].slice.call(таб.querySelectorAll('thead th'));
    const перваяСтрока = [].slice.call(таб.querySelectorAll('tbody tr:first-child td'));
    /* Заголовок и данные обязаны стоять в одной колонке: сравниваем правый
       край у числовых и левый у текстовых. */
    const совпали = шапка.every((th, i) => {
      const td = перваяСтрока[i]; if (!td) return false;
      const a = th.getBoundingClientRect(), b = td.getBoundingClientRect();
      const коробка = th.classList.contains('n')
        ? Math.abs(a.right - b.right) < 2
        : Math.abs(a.left - b.left) < 2;
      /* Совпадения коробок мало: у ячейки и заголовка может быть разное
         выравнивание текста внутри одной и той же колонки, и тогда шапка
         стоит слева, а данные уезжают вправо. */
      const текст = getComputedStyle(th).textAlign === getComputedStyle(td).textAlign;
      return коробка && текст;
    });
    const таблица = {
      колонок: шапка.length,
      ячеек: перваяСтрока.length,
      заголовки: шапка.map(th => th.textContent),
      совпали: совпали,
      номерУзкий: Math.round(шапка[0].getBoundingClientRect().width),
      выделеннаяШапка: (таб.querySelector('thead th.sel') || {}).textContent,
      выделенныхЯчеек: таб.querySelectorAll('tbody tr:first-child td.sel').length
    };

    /* Подписки — люди, а не ставка: «0,4 подписки» не бывает. */
    CT.sort = 'gain'; CT.view = 'tiles'; renderContentFx();
    const перваяКарта = document.querySelector('#content-ag .cfx-grid .cfx-cardu');
    const ячейки = [].slice.call(перваяКарта.querySelectorAll('.cfx-mets span'));
    const знач = s => (s.querySelector('b') || {}).textContent || '';
    const подписки = {
      наКарточке: знач(ячейки[0]),
      охват: (function(){ const c = ячейки.filter(s => s.querySelector('i').textContent === 'Охват')[0];
        return c ? знач(c) : ''; })()
    };

    CT.sort = 'score'; CT.view = 'tiles'; renderContentFx();
    if(_login && !_былСкрыт) _login.classList.remove('hidden');
    if(_app && !_былВключён) _app.classList.remove('on');
    return { поИндексу, поПросмотрам, таблица, подписки };
  }, { пуб: пуб() });

  ok('в сортировке есть просмотры', I.поИндексу.чипы.indexOf('Просмотры') >= 0, I.поИндексу.чипы);
  ok('и стоят сразу за охватом',
      I.поИндексу.чипы.indexOf('Просмотры') === I.поИндексу.чипы.indexOf('Охват') + 1, I.поИндексу.чипы);
  ok('на карточке по-прежнему четыре метрики', I.поИндексу.метрик === 4, I.поИндексу);
  /* При сортировке по индексу подсвечивать в ряду нечего: индекс уже стоит
     крупно справа, и дублировать его позицией из четырёх — потеря места. */
  ok('при сортировке по индексу ряд метрик не дублирует его',
      I.поИндексу.акцентов === 0 && I.поИндексу.перваяМетрика === 'Охват', I.поИндексу);
  ok('при сортировке по просмотрам они выходят на карточку первыми',
      I.поПросмотрам.перваяМетрика === 'Просмотры', I.поПросмотрам);
  ok('и подсвечены', I.поПросмотрам.акцентНаПервой, I.поПросмотрам);
  ok('порядок карточек — по просмотрам, а не по охвату',
      I.поПросмотрам.порядок[0] === 'ролик 1' && I.поПросмотрам.порядок[5] === 'ролик 6',
      I.поПросмотрам.порядок);
  ok('в таблице столько же ячеек, сколько заголовков',
      I.таблица.колонок === I.таблица.ячеек && I.таблица.колонок >= 10, I.таблица);
  ok('колонка подписок в таблице есть', I.таблица.заголовки.indexOf('Подписки') >= 0, I.таблица.заголовки);
  ok('колонка просмотров в таблице есть', I.таблица.заголовки.indexOf('Просмотры') >= 0, I.таблица.заголовки);
  ok('заголовки стоят ровно над своими данными', I.таблица.совпали, I.таблица);
  ok('колонка номера узкая, а не в треть экрана',
      I.таблица.номерУзкий > 20 && I.таблица.номерУзкий < 90, I.таблица.номерУзкий);
  ok('колонка, по которой ранжируем, подсвечена в шапке',
      I.таблица.выделеннаяШапка === 'Просмотры', I.таблица);
  ok('и в данных', I.таблица.выделенныхЯчеек === 1, I.таблица);
  ok('подписки показаны целым числом людей, а не дробной ставкой',
      /^\+\d[\d\u00a0 ]*$/.test(I.подписки.наКарточке) && I.подписки.наКарточке.indexOf(',') < 0,
      I.подписки);
  ok('охват на карточке не сокращён до «тыс.»',
      I.подписки.охват.indexOf('тыс') < 0 && /\d/.test(I.подписки.охват), I.подписки);


  /* ─────────────────────────────────────────────────────────────────────── */
  console.log('[J] разворот: вердикт, место в распределении, отпечаток реакций');

  const J = await page.evaluate(({ пуб }) => {
    const п = (o) => Object.assign({}, пуб, o || {});
    /* Четыре публикации по одной в каждый квадрант поля «масштаб × качество».
       Медиана охвата и медиана качества делят выборку пополам, поэтому
       достаточно развести пары «много/мало охвата» и «сильная/слабая реакция». */
    const рилсы = [
      п({ title:'широко и живо',  reach:100000, views:200000, likes:9000, comments:2200, saves:1400, shares:1400, gain:80 }),
      п({ title:'широко и пусто', reach:120000, views:240000, likes:300,  comments:20,   saves:6,    shares:5,    gain:1 }),
      п({ title:'узко и живо',    reach:4000,   views:9000,   likes:360,  comments:88,   saves:56,   shares:56,   gain:9 }),
      п({ title:'узко и пусто',   reach:3000,   views:7000,   likes:10,   comments:1,    saves:0,    shares:0,    gain:0 })
    ];
    PROJECTS.length = 0; PROJECTS.push({ id: 'p1', name: 'Тест' });
    CT_RAW = [{ id:'r1', project_id:'p1', title:'о', published_at:'2026-07-01T00:00:00Z',
      payload: { period:'МАЙ', posts: [], reels: рилсы } }];
    CT_SIG = ctSig(); CT.project=''; CT.period=''; CT.kind='all'; CT.sort='score';
    CT.view='tiles'; CT.tab='content'; renderContentFx();

    const st = ctState();
    const по = n => st.units.filter(u => u.title === n)[0];
    const карт = [].slice.call(document.querySelectorAll('#content-ag .cfx-grid .cfx-cardu'));
    const первая = карт[0];

    return {
      вердикты: {
        живо:  (по('широко и живо')  || {}).verdict,
        пусто: (по('широко и пусто') || {}).verdict,
        узко:  (по('узко и живо')    || {}).verdict,
        снять: (по('узко и пусто')   || {}).verdict
      },
      перцентиль: (по('широко и пусто') || {}).pct,
      наЭкране: {
        вердиктов: document.querySelectorAll('#content-ag .cfx-grid .cfx-verd').length,
        карточек: карт.length,
        словоВердикта: (первая.querySelector('.cfx-vt') || {}).textContent,
        поясн: (первая.querySelector('.cfx-vw') || {}).textContent,
        миниПоле: !!первая.querySelector('.cfx-mf'),
        точекНаПоле: первая.querySelectorAll('.cfx-mf circle').length,
        отпечатков: document.querySelectorAll('#content-ag .cfx-grid .cfx-fpb').length,
        долейВОтпечатке: первая.querySelectorAll('.cfx-fpb i').length,
        подписиПодМетрикой: [].slice.call(первая.querySelectorAll('.cfx-mets u')).map(x => x.textContent),
        индекс: (первая.querySelector('.cfx-idx b') || {}).textContent
      },
      /* Публикация с испорченными данными вердикта не получает: суждение по
         числам, которым не верим, хуже отсутствия суждения. */
      безОценки: (function(){
        CT_RAW = [{ id:'r2', project_id:'p1', title:'о', published_at:'2026-07-01T00:00:00Z',
          payload:{ period:'X', posts:[], reels:[
            п({ title:'опечатка', reach:51507, views:57502, likes:384, comments:25765, saves:13, shares:45 }),
            п({ rubric:'B' }), п({ rubric:'B' }), п({ rubric:'B' })] } }];
        CT_SIG = ctSig(); renderContentFx();
        const плохая = ctState().units.filter(u => u.title === 'опечатка')[0];
        return { вердикт: плохая ? плохая.verdict : 'нет публикации',
                 наЭкране: !!document.querySelector('#content-ag .cfx-verd.off') };
      })()
    };
  }, { пуб: пуб() });

  ok('широкий показ и живая реакция → масштабировать', J.вердикты.живо === 'scale', J.вердикты);
  ok('широкий показ без реакции → охват пустой', J.вердикты.пусто === 'empty', J.вердикты);
  ok('сильная реакция при узком показе → провал показа', J.вердикты.узко === 'dist', J.вердикты);
  ok('слабо и там и там → снимать с полки', J.вердикты.снять === 'drop', J.вердикты);
  ok('перцентиль считается для каждой метрики',
      J.перцентиль && J.перцентиль.reach === 75 && J.перцентиль.er === 0, J.перцентиль);
  ok('вердикт есть на каждой карточке',
      J.наЭкране.вердиктов === J.наЭкране.карточек && J.наЭкране.карточек === 4, J.наЭкране);
  ok('вердикт назван словом и пояснён', /\S/.test(J.наЭкране.словоВердикта || '')
      && /\S/.test(J.наЭкране.поясн || ''), J.наЭкране);
  ok('миниатюра поля нарисована и показывает всю выборку',
      J.наЭкране.миниПоле && J.наЭкране.точекНаПоле === 4, J.наЭкране);
  ok('отпечаток реакций на каждой карточке',
      J.наЭкране.отпечатков === 4 && J.наЭкране.долейВОтпечатке === 4, J.наЭкране);
  ok('под метриками стоит место в распределении',
      J.наЭкране.подписиПодМетрикой.filter(s => /выше \d+ %/.test(s)).length >= 2,
      J.наЭкране.подписиПодМетрикой);
  ok('индекс вынесен отдельно', /^\d+$/.test(J.наЭкране.индекс || ''), J.наЭкране.индекс);
  ok('публикация с испорченными данными вердикта не получает',
      J.безОценки.вердикт === null && J.безОценки.наЭкране, J.безОценки);

  /* ─────────────────────────────────────────────────────────────────────── */
  console.log('[E] вёрстка: три ширины, отсутствие горизонтальной прокрутки');

  for (const [ш, в] of [[390, 844], [1600, 1000], [2400, 1200]]) {
    await page.setViewportSize({ width: ш, height: в });
    for (const вкл of ['content', 'rubrics', 'findings']) {
      const r = await page.evaluate((t) => {
        CT.tab = t; renderContentFx();
        document.querySelectorAll('#content-ag .rv').forEach(e => e.classList.add('in'));
        const de = document.documentElement;
        return { гор: de.scrollWidth > de.clientWidth + 1, пусто: !document.querySelector('#content-ag').textContent.trim() };
      }, вкл);
      ok('нет горизонтальной прокрутки · ' + вкл + ' · ' + ш + 'px', !r.гор, r);
      ok('вкладка не пустая · ' + вкл + ' · ' + ш + 'px', !r.пусто);
    }
  }

  await page.setViewportSize({ width: 1600, height: 1000 });
  const M = await page.evaluate(() => {
    /* Читаем исходный текст стилей, а не CSSOM: браузер переписывает
       сокращения, и регулярка по cssText ловит не то, что написано. */
    const весь = Array.from(document.querySelectorAll('style')).map(s => s.textContent).join('\n');
    const i = весь.indexOf('##CT-CSS-START##');
    const блок = i < 0 ? '' : весь.slice(i, весь.indexOf('##CT-CSS-END##'));
    const m = блок.match(/@media\s*\(prefers-reduced-motion:reduce\)\{[\s\S]*?\n\}/);
    return !!m && /cfx-cardu/.test(m[0]) && /cfx-kpi/.test(m[0]);
  });
  ok('анимации выключаются при prefers-reduced-motion', M, M);

  const reduced = await b.newPage({ viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' });
  await reduced.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await reduced.waitForTimeout(1200);
  await reduced.evaluate(() => {
    window.agActiveProjects = function(){
      return (typeof PROJECTS !== 'undefined' && PROJECTS) ? PROJECTS.slice() : [];
    };
  });
  const R = await reduced.evaluate(({ пуб }) => {
    const п = (o) => Object.assign({}, пуб, o || {});
    if (typeof PROJECTS !== 'undefined' && !PROJECTS.filter(x => String(x.id) === 'p1').length) PROJECTS.push({ id: 'p1', name: 'Тест' });
    CT_RAW = [{ id: 'r1', project_id: 'p1', title: 'о', published_at: '2026-07-01',
      payload: { period: 'X', posts: [], reels: [п({ rubric: 'A' }), п({ rubric: 'A' }), п({ rubric: 'B' }), п({ rubric: 'B' })] } }];
    CT_SIG = ctSig();
    CT.tab = 'content'; renderContentFx();
    const c = document.querySelector('#content-ag .cfx-kpi');
    const cs = c ? getComputedStyle(c) : null;
    return { видна: cs ? (cs.opacity === '1') : null, безСдвига: cs ? (cs.transform === 'none') : null };
  }, { пуб: пуб() });
  ok('при reduce блоки видны сразу', R.видна === true, R);
  ok('и не сдвинуты', R.безСдвига === true, R);
  await reduced.close();

  ok('ошибок в консоли нет', errs.length === 0, errs.slice(0, 3));

  await b.close();
  console.log('\n' + pass + ' ok · ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})();
