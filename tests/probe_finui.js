/* probe_finui — экран денег, окно операции и журнал.

   Арифметику проверяет probe_finmath. Здесь другое: доходит ли посчитанное
   до экрана без потерь и не даёт ли форма записать заведомо неверное.

   Что проверяем:
     пока счетов нет — не пустой экран, а объяснение и две кнопки;
     остаток на карточке равен посчитанному, минус показан минусом;
     резерв помечен и в оборотные не входит;
     форма меняет поля от типа: у перевода второй счёт, у займа проценты;
     перевод на тот же счёт, нулевая сумма и проценты больше платежа — не проходят;
     отмена требует причину и не спрашивает её системным окном. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  const dialogs = []; page.on('dialog', d => { dialogs.push(d.type()); d.dismiss().catch(() => {}); });
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  /* Даты — от сегодняшнего дня и только назад: остаток считается на сегодня,
     и операция, датированная завтра, в него намеренно не входит. С жёстко
     вписанными датами проверка ломалась бы от смены числа, а не от кода. */
  const seed = () => page.evaluate(() => {
    const z = v => String(v).padStart(2, '0');
    const dd = k => { const d = new Date(); d.setDate(d.getDate() + k);
      return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
    window.FINP = []; window.FINO = []; window.FINS = {};
    window.FINX = { ready: true, accounts: [
      { id: 'A', name: 'Наличка', kind: 'cash',   opening_balance: 300000,  sort: 1 },
      { id: 'B', name: 'Карта',   kind: 'card',   opening_balance: 5000000, sort: 2 },
      { id: 'R', name: 'Резерв',  kind: 'card',   opening_balance: 4000000, sort: 3, is_reserve: true },
    ], ops: [
      { id: 'o1', op_date: dd(-3), kind: 'expense', amount: 1000000, account_id: 'A',
        category: 'Аренда', note: 'август', created_at: '2026-08-02T09:00:00Z' },
      { id: 'o2', op_date: dd(-2), kind: 'income',  amount: 2000000, account_id: 'B',
        note: 'Qushbegi', created_at: '2026-08-03T09:00:00Z' },
      { id: 'o3', op_date: dd(-1), kind: 'transfer', amount: 500000, account_id: 'B', account_to: 'R',
        created_at: '2026-08-04T09:00:00Z' },
      { id: 'o4', op_date: dd(-1), kind: 'expense', amount: 900000, account_id: 'B',
        voided_at: '2026-08-05T10:00:00Z', void_reason: 'записана дважды', created_at: '2026-08-05T09:00:00Z' },
    ] };
  });

  console.log('[A] пока счетов нет');
  const E = await page.evaluate(() => {
    window.FINX = { ready: true, accounts: [], ops: [] };
    const h = finMoneyBlock();
    return { h, empty: /fnx-empty/.test(h), quick: /finAccQuick/.test(h), manual: /finAccOpen/.test(h) };
  });
  ok('вместо пустоты — объяснение, что такое счёт', E.empty, E.h.slice(0, 80));
  ok('и два пути: четыре типовых счёта или вручную', E.quick && E.manual, [E.quick, E.manual]);

  console.log('[B] экран денег');
  await seed();
  const M = await page.evaluate(() => {
    const d = document.createElement('div'); d.id = 'fnx-probe';
    d.innerHTML = finMoneyBlock(); document.body.appendChild(d);
    const txt = s => (d.querySelector(s) || {}).textContent || '';
    const m = finMath(window.FINX.accounts, window.FINX.ops, { asOf: finToday() });
    return { hero: txt('.fnx-h-v').replace(/\s/g, ''), sub: txt('.fnx-h-sub').replace(/\s/g, ''),
      cards: d.querySelectorAll('.fnx-acc').length,
      res: d.querySelectorAll('.fnx-acc.res').length,
      resTag: /резерв/.test(txt('.fnx-acc.res .fnx-a-f')),
      resNameFull: (txt('.fnx-acc.res .fnx-a-nm') || '').trim() === 'Резерв',
      negV: (d.querySelector('.fnx-a-v.neg') || {}).textContent || '',
      warn: /ушёл в минус/.test(d.textContent || ''),
      add: !!d.querySelector('.fnx-add'),
      math: { total: m.total, working: m.working, reserve: m.reserve, A: m.byId.A.bal } };
  });
  /* На бумаге: A = 300 000 − 1 000 000 = −700 000 (отменённая не в счёт),
     B = 5 000 000 + 2 000 000 − 500 000 = 6 500 000, R = 4 000 000 + 500 000 = 4 500 000.
     Всего 10 300 000, резерв 4 500 000, оборотных 5 800 000. */
  ok('всего денег 10 300 000 и это же стоит в заголовке',
    M.math.total === 10300000 && M.hero.indexOf('10300000') === 0, [M.math.total, M.hero]);
  ok('оборотные 5 800 000 — резерв в них не входит',
    M.math.working === 5800000 && M.math.reserve === 4500000 && /5800000/.test(M.sub), [M.math, M.sub]);
  ok('карточек ровно три, резервная помечена',
    M.cards === 3 && M.res === 1 && M.resTag, [M.cards, M.res, M.resTag]);
  ok('минус на счету показан минусом, а не нулём',
    M.math.A === -700000 && /−\s*700/.test(M.negV.replace(/ /g, ' ')), [M.math.A, M.negV]);
  ok('и рядом сказано, что так обычно выглядит ошибка ввода', M.warn, M.warn);
  ok('«резерв» стоит в подписи, а не съедает имя счёта',
    M.resTag && M.resNameFull, [M.resTag, M.resNameFull]);
  ok('кнопка «+ счёт» стоит в том же ряду', M.add, M.add);

  /* Опечатка в дате — самая тихая из ошибок ввода: операция есть, а денег
     не убыло. Модуль про такие говорит вслух, а не прячет их. */
  const AH = await page.evaluate(() => {
    const z = v => String(v).padStart(2, '0');
    const d1 = new Date(); d1.setDate(d1.getDate() + 5);
    window.FINX.ops = window.FINX.ops.concat([{ id: 'fut', kind: 'expense', amount: 400000, account_id: 'B',
      op_date: d1.getFullYear() + '-' + z(d1.getMonth() + 1) + '-' + z(d1.getDate()) }]);
    const d = document.createElement('div'); d.innerHTML = finMoneyBlock();
    const m = finMath(window.FINX.accounts, window.FINX.ops, { asOf: finToday() });
    return { total: m.total, txt: (d.textContent || '').replace(/\s+/g, ' ') };
  });
  ok('операция будущим числом остаток не трогает', AH.total === 10300000, AH.total);
  ok('но про неё сказано прямо — это чаще всего опечатка в дате',
    /будущим числом/.test(AH.txt), AH.txt.slice(0, 160));

  /* Деньги и заработок теперь стоят на разных шагах — намеренно. Шаг 1
     отвечает «чем платить сегодня», шаг 3 — «сколько заработали за месяц».
     Раньше оба числа стояли в одной шапке под похожими подписями, и аванс,
     который раздувает первое и не трогает второе, читался как прибыль.

     ── На бумаге ─────────────────────────────────────────────────────
     оплата 1 000 000 + аванс 3 000 000 − расход 400 000 = 3 600 000 на счёте
     приход месяца 4 000 000 (это деньги), расход 400 000, остаток 3 600 000
     выручка при этом 1 000 000, прибыль 600 000: аванс ещё не заработан */
  const H = await page.evaluate(() => {
    const n = new Date(), z = v => String(v).padStart(2, '0');
    const td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-' + z(n.getDate());
    window._FINOFF = 0;
    window.FINX = { ready: true, accounts: [{ id: 'B', name: 'Карта', kind: 'card', opening_balance: 0, sort: 1 }],
      ops: [ { id: 'i1', op_date: td, kind: 'income',  amount: 1000000, account_id: 'B' },
             { id: 'p1', op_date: td, kind: 'prepay',  amount: 3000000, account_id: 'B' },
             { id: 'e1', op_date: td, kind: 'expense', amount: 400000,  account_id: 'B' } ] };
    window.FINP = []; window.FINO = []; window.FINS = {};
    const d = document.createElement('div'); d.innerHTML = finMoneyBlock();
    const t = s => (d.querySelector(s) || {}).textContent || '';
    const m = finMath(window.FINX.accounts, window.FINX.ops, { asOf: finToday() });
    const s3 = document.createElement('div'); s3.innerHTML = finStepMonth();
    const nums = Array.from(s3.querySelectorAll('.fst-3 .fst-c')).map(e => ({
      l: (e.querySelector('.l') || {}).textContent || '',
      v: ((e.querySelector('.v') || {}).textContent || '').replace(/\s/g, '') }));
    const s4 = document.createElement('div'); s4.innerHTML = finStepRest();
    return { note: t('.fnx-h-note'), hero: t('.fnx-h-v').replace(/\s/g, ''),
      rev: m.revenue, prof: m.profit, pre: m.prepaid, nums,
      noPer: !d.querySelector('.fnx-h-per'),
      restNote: (s4.querySelector('.fst-note') || {}).textContent || '' };
  });
  ok('на первом шаге стоит только «сколько есть» — месяц уехал в шаг 3',
    H.noPer === true && H.hero.indexOf('3600000') === 0, [H.noPer, H.hero]);
  /* Раньше подпись гласила «из них авансов на N», сравнивая сумму за месяц
     с остатком на сегодня: при расходе следом за авансом выходило «есть
     2 000 000, из них авансов 20 000 000». Теперь период назван прямо. */
  ok('про аванс сказано прямо и с указанием месяца, а не «из них»',
    /За август авансами пришло 3 000 000/.test(H.note) && /не делятся/.test(H.note)
      && !/Из них/.test(H.note), H.note);
  ok('шаг 3: приход 4 000 000 — это деньги, а не выручка',
    H.nums[0] && /Приход/.test(H.nums[0].l) && H.nums[0].v === '+4000000\u0441\u0443\u043c', H.nums[0]);
  ok('расход 400 000 и остаток месяца 3 600 000',
    H.nums[1].v === '\u2212400000\u0441\u0443\u043c' && H.nums[2].v === '+3600000\u0441\u0443\u043c', H.nums);
  ok('аванс 3 000 000 в прибыль не вошёл: выручка 1 000 000, прибыль 600 000',
    H.pre === 3000000 && H.rev === 1000000 && H.prof === 600000, [H.pre, H.rev, H.prof]);
  /* Остаток месяца и деньги на счетах здесь совпадают — и модуль обязан
     сказать это словами. Молчание в этом месте читается как «одно из двух
     чисел неверно». */
  ok('шаг 4 объясняет, что деньги на счетах равны остатку месяца',
    /равны остатку месяца/.test(H.restNote), H.restNote);

  console.log('[C] форма операции подстраивается под тип');
  const F = await page.evaluate(() => {
    const q = () => document.getElementById('fnx-op-b').innerHTML;
    finOpOpen('expense'); const exp = q();
    finOpKind('transfer'); const tr = q();
    finOpGrp('in'); const inn = q();
    finOpKind('loan_repay'); const lr = q();
    finOpKind('prepay'); const pp = q();
    return {
      groups: (document.querySelectorAll('.fnx-g') || []).length,
      expCat: /fnx-o-ct/.test(exp), expNoTo: !/fnx-o-a2/.test(exp),
      trTo: /fnx-o-a2/.test(tr), trNoCat: !/fnx-o-ct/.test(tr),
      inFirst: /fnx-k on/.test(inn),
      lrInt: /fnx-o-it/.test(lr), ppPer: /fnx-o-pf/.test(pp) && /fnx-o-pt/.test(pp),
      hint: (document.querySelector('.fnx-hint') || {}).textContent || '' };
  });
  ok('четыре кнопки наверху — всё, что выбирают в обычный день', F.groups === 4, F.groups);
  ok('у расхода есть статья и нет второго счёта', F.expCat && F.expNoTo, F);
  ok('у перевода появляется «куда» и исчезает статья', F.trTo && F.trNoCat, F);
  ok('у платежа по займу спрашивают проценты отдельно', F.lrInt, F.lrInt);
  ok('у аванса спрашивают, за какой период он', F.ppPer, F.ppPer);
  ok('под формой объяснено, что этот тип делает с прибылью',
    /аванс/i.test(F.hint) && F.hint.length > 40, F.hint);

  console.log('[C2] контролы платформенные, а не браузерные');
  await seed();
  /* Родное поле type=date рисует календарь силами системы: белый, синий и
     ни в одной теме не участвует. Родной select — то же самое. В форме
     финансов их быть не должно. */
  const NC = await page.evaluate(() => {
    finOpOpen('transfer');
    const b = document.getElementById('fnx-op-b');
    const accs = window.FINX.accounts.filter(a => !a.archived_at);
    return { natSel: b.querySelectorAll('select').length,
      natDate: b.querySelectorAll('input[type=date]').length,
      dd: b.querySelectorAll('.dd.ddsel').length,
      dp: b.querySelectorAll('.dpick').length,
      from: (document.getElementById('fnx-o-ac') || {}).value,
      to: (document.getElementById('fnx-o-a2') || {}).value,
      second: accs[1] && accs[1].id };
  });
  ok('родных выпадающих списков в форме нет', NC.natSel === 0, NC.natSel);
  ok('родного поля даты тоже нет', NC.natDate === 0, NC.natDate);
  ok('вместо них — платформенные', NC.dd >= 2 && NC.dp === 1, NC);
  ok('у перевода стороны разные, а не «сам себе»',
    NC.from && NC.to && NC.from !== NC.to && NC.to === NC.second, NC);

  console.log('[C3] счёт по умолчанию — рабочий, а не первый в списке');
  /* Живой случай: резерв заведён первым, и расход по умолчанию уходил с
     него, загоняя резерв в минус. Резерв тратят осознанно, а не по
     умолчанию — и предзаполненный платёж обязан показывать тот счёт,
     который на самом деле подставлен. */
  const DF = await page.evaluate(async () => {
    window.FINX = { ready: true, accounts: [
      { id: 'R', name: 'РЕЗЕРВ', kind: 'card', opening_balance: 0, sort: 1, is_reserve: true },
      { id: 'C', name: 'Наличка', kind: 'cash', opening_balance: 9000000, sort: 2 },
      { id: 'K', name: 'Карта',   kind: 'card', opening_balance: 0, sort: 3 } ], ops: [] };
    const z = v => String(v).padStart(2, '0');
    const n = new Date(); const td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-' + z(n.getDate());
    window.FINP = [{ id: 'p1', flow: 'out', title: 'Аутсорс', amount: 7000000, every: 'once',
      due_date: td, account_id: 'K' }];
    window.FINO = []; window.FINS = {};
    finOpOpen('expense');
    const def = { v: (document.getElementById('fnx-o-ac') || {}).value,
      lbl: (document.getElementById('fnx-o-ac-lbl') || {}).textContent || '',
      warn: (document.getElementById('fnx-o-resw') || {}).style.display };
    /* Явный выбор резерва разрешён, но о нём предупреждают. */
    _finFill('fnx-o-ac', 'R');
    const onRes = { v: (document.getElementById('fnx-o-ac') || {}).value,
      lbl: (document.getElementById('fnx-o-ac-lbl') || {}).textContent || '',
      warn: (document.getElementById('fnx-o-resw') || {}).style.display };
    finClose();
    finPayPlan('p1', td);
    await new Promise(r => setTimeout(r, 160));
    const paid = { v: (document.getElementById('fnx-o-ac') || {}).value,
      lbl: (document.getElementById('fnx-o-ac-lbl') || {}).textContent || '' };
    finClose();
    return { def, onRes, paid };
  });
  ok('по умолчанию подставлен рабочий счёт, а не резерв, стоящий первым',
    DF.def.v === 'C' && /Наличка/.test(DF.def.lbl), DF.def);
  ok('и предупреждения про резерв нет, пока резерв не выбран',
    DF.def.warn === 'none', DF.def);
  ok('выбрать резерв можно, но об этом говорят вслух',
    DF.onRes.v === 'R' && DF.onRes.warn !== 'none', DF.onRes);
  ok('счёт из плана подставляется и в значение, и в подпись',
    DF.paid.v === 'K' && /Карта/.test(DF.paid.lbl), DF.paid);

  console.log('[D] форма не даёт записать заведомо неверное');
  const V = await page.evaluate(async () => {
    const said = [];
    const _t = window.toast; window.toast = m => said.push(m);
    window.tFinSaveOp = () => Promise.resolve();
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    finOpOpen('expense'); set('fnx-o-am', ''); finOpSave();            // нулевая сумма
    finOpOpen('transfer'); set('fnx-o-am', '100 000');
    set('fnx-o-ac', 'B'); set('fnx-o-a2', 'B'); finOpSave();            // сам себе
    finOpOpen('loan_repay'); set('fnx-o-am', '100 000'); set('fnx-o-it', '200 000'); finOpSave();
    finOpOpen('expense'); set('fnx-o-am', '50 000'); set('fnx-o-dt', ''); finOpSave();
    window.toast = _t;
    return said;
  });
  ok('нулевую сумму не пропускает', /больше нуля/.test(V[0] || ''), V);
  ok('перевод на тот же счёт не пропускает', /тот же счёт/.test(V[1] || ''), V);
  ok('проценты больше платежа не пропускает', /больше платежа/.test(V[2] || ''), V);
  ok('операцию без даты не пропускает', /без даты/i.test(V[3] || ''), V);

  console.log('[E] защита от двойного ввода');
  await seed();
  const D = await page.evaluate(async () => {
    const said = []; const _t = window.toast; window.toast = m => said.push(m);
    let saved = 0; window.tFinSaveOp = () => { saved++; return Promise.resolve(); };
    const today = new Date(), z = n => String(n).padStart(2, '0');
    const td = today.getFullYear() + '-' + z(today.getMonth() + 1) + '-' + z(today.getDate());
    window.FINX.ops = window.FINX.ops.concat([{ id: 'dup', op_date: td, kind: 'expense', amount: 500000,
      account_id: 'A', created_at: new Date().toISOString() }]);
    window._finDupOk = false;
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    finOpOpen('expense'); set('fnx-o-am', '500 000'); set('fnx-o-ac', 'A'); set('fnx-o-dt', td);
    finOpSave();                       // первый раз — предупреждение
    const first = saved;
    finOpSave();                       // второй раз — записываем
    window.toast = _t;
    return { said, first, after: saved };
  });
  ok('похожая операция за последние минуты — сначала предупреждение',
    D.first === 0 && /уже записана/.test(D.said[0] || ''), D);
  ok('но повторное нажатие записывает: решает человек, а не догадка', D.after === 1, D);

  console.log('[F] журнал');
  await seed();
  const L = await page.evaluate(() => {
    finLogOpen();
    const b = document.getElementById('fnx-log-b');
    const rows = b.querySelectorAll('.fnx-row').length;
    const voided = b.querySelectorAll('.fnx-row.void').length;
    const reason = /записана дважды/.test(b.textContent || '');
    finLogSet('grp', 'out'); const onlyOut = b.querySelectorAll('.fnx-row').length;
    finLogSet('grp', ''); finLogSet('acc', 'R'); const onlyR = b.querySelectorAll('.fnx-row').length;
    finLogSet('acc', '');
    return { rows, voided, reason, onlyOut, onlyR };
  });
  ok('в журнале все четыре операции, включая отменённую', L.rows === 4, L);
  ok('отменённая помечена и причина видна', L.voided === 1 && L.reason, L);
  ok('фильтр «Ушло» оставляет только расходы', L.onlyOut === 2, L.onlyOut);
  ok('фильтр по счёту ловит и вторую сторону перевода', L.onlyR === 1, L.onlyR);

  console.log('[G] отмена требует причину и не зовёт системное окно');
  const VD = await page.evaluate(async () => {
    const said = []; const _t = window.toast; window.toast = m => said.push(m);
    let voided = null; window.tFinVoidOp = (id, why) => { voided = [id, why]; return Promise.resolve(); };
    finLogOpen(); finOpVoid('o1');
    const asked = !!document.getElementById('fnx-void-r');
    finOpVoidGo('o1');                                   // без причины
    const empty = said.slice();
    document.getElementById('fnx-void-r').value = 'ошиблись счётом';
    finOpVoidGo('o1');
    await new Promise(r => setTimeout(r, 60));
    window.toast = _t;
    return { asked, empty, voided };
  });
  ok('причину спрашивает своё окно внутри журнала', VD.asked, VD.asked);
  ok('без причины отмена не проходит', /Без причины/.test(VD.empty[0] || ''), VD.empty);
  ok('с причиной — уходит вместе с ней', VD.voided && VD.voided[1] === 'ошиблись счётом', VD.voided);
  ok('системных окон браузера модуль не открывает', dialogs.length === 0, dialogs);

  console.log('[G2] один язык с остальным модулем');
  /* Модуль уже говорит моноширинными числами с разрядкой в подписях. Новые
     блоки обязаны говорить так же: третий стиль на одном экране — это не
     стиль, а разнобой. */
  const TY = await page.evaluate(() => {
    const d = document.createElement('div'); d.id = 'fnx-ty';
    d.innerHTML = finMoneyBlock(); document.body.appendChild(d);
    const f = s => { const e = d.querySelector(s); if (!e) return null;
      const c = getComputedStyle(e); return { fam: c.fontFamily, ls: c.letterSpacing, tt: c.textTransform }; };
    /* Раньше сверялись со старым блоком P&L. Его больше нет — сверяемся с
       шагом «Месяц»: он и есть эталон нового языка модуля. */
    const st = document.createElement('div'); st.innerHTML = finStepMonth();
    document.body.appendChild(st);
    const g = s2 => { const e = st.querySelector(s2); if (!e) return null;
      const c = getComputedStyle(e); return { fam: c.fontFamily, ls: c.letterSpacing, tt: c.textTransform }; };
    const step = { num: g('.fst-3 .fst-c .v'), lab: g('.fst-3 .fst-c .l') };
    st.remove();
    const r = { hero: f('.fnx-h-v'), lab: f('.fnx-h-l'), acc: f('.fnx-a-v'), accNm: f('.fnx-a-nm'), step };
    d.remove(); return r;
  });
  const mono = v => v && /Mono|mono/.test(v.fam);
  ok('главное число и числа шагов набраны одним моноширинным',
    mono(TY.hero) && mono(TY.step.num) && TY.hero.fam === TY.step.num.fam, [TY.hero, TY.step.num]);
  ok('подписи шагов — тот же капительный моноширинный, что и здесь',
    mono(TY.step.lab) && TY.step.lab.tt === 'uppercase' && parseFloat(TY.step.lab.ls) > 1, TY.step.lab);
  ok('подписи — тот же моноширинный в разрядку и капителью',
    mono(TY.lab) && TY.lab.tt === 'uppercase' && parseFloat(TY.lab.ls) > 1, TY.lab);
  ok('остаток счёта тоже моноширинный — цифры в колонке выстраиваются',
    mono(TY.acc), TY.acc);
  ok('и имя счёта набрано как подпись плитки, а не как заголовок',
    mono(TY.accNm) && TY.accNm.tt === 'uppercase', TY.accNm);

  console.log('[G2b] ни одного системного списка и календаря во всём модуле');
  /* Серый прямоугольник, нарисованный операционной системой, посреди
     фирменного окна читается как чужая программа — и заодно ведёт себя
     иначе на каждой платформе. В журнале два таких списка жили с самого
     начала: их не замечали, потому что они были «просто фильтры». */
  const NAT = await page.evaluate(() => {
    const n = new Date(), z = v => String(v).padStart(2, '0');
    const td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-' + z(n.getDate());
    window.__me = { id: 'u1', role: 'agency_owner' }; window.tMe = () => window.__me;
    window._FINOFF = 0;
    window.FINX = { ready: true, accounts: [
      { id: 'W', name: 'Карта', kind: 'card', opening_balance: 0, sort: 1 },
      { id: 'R', name: 'Резерв', kind: 'bank', opening_balance: 0, purpose: 'reserve', is_reserve: true, sort: 2 }],
      ops: [ { id: 'i', op_date: td, kind: 'income', amount: 20000000, account_id: 'W', category: 'Оплата клиента' },
             { id: 'e', op_date: td, kind: 'expense', amount: 8000000, account_id: 'W', category: 'Зарплаты' } ] };
    window.FINP = [{ id: 'p1', flow: 'out', title: 'Аренда', amount: 1000000, every: 'month',
      day_of_month: 10, category: 'Аренда' }];
    window.FINO = [{ id: 'o1', name: 'Нурислам', share_pct: 100, sort: 1 }];
    window.FINS = { owners_pct: 40, reserve_pct: 20, charity_pct: 0 }; window.FINM = [];
    const count = () => document.querySelectorAll('#ov-fin select, #ov-fin input[type=date]').length;
    const out = {};
    finLogOpen();        out.log = count();
    finAccOpen();        out.accs = count();
    finAccEdit('W');     out.acc = count();
    finOpOpen('expense');out.op = count();
    finOpKind('transfer');out.tr = count();
    finRecOpen('W');     out.rec = count();
    finDistCfg();        out.cfg = count();
    finDistOpen();       out.dist = count();
    finNextOpen();       out.next = count();
    finClose();
    return out;
  });
  ok('в журнале фильтры платформенные, а не системные', NAT.log === 0, NAT.log);
  ok('в счетах и в карточке счёта тоже', NAT.accs === 0 && NAT.acc === 0, NAT);
  ok('в записи операции и в переводе', NAT.op === 0 && NAT.tr === 0, NAT);
  ok('в сверке, долях, распределении и следующем месяце',
    NAT.rec === 0 && NAT.cfg === 0 && NAT.dist === 0 && NAT.next === 0, NAT);

  console.log('[G3] семь шагов сверху вниз — и ни одного дубля');
  /* Раньше в модуле жили две несвязанные системы: плановая (сметы) и
     фактическая (журнал). Одна и та же маржа считалась в четырёх местах по
     трём базам, распределение прибыли — в localStorage рядом с
     совладельцами из базы. Правильного ответа на вопрос «на что смотреть»
     не было вовсе. Теперь порядок и есть ответ. */
  const SM = await page.evaluate(() => {
    const n = new Date(), z = v => String(v).padStart(2, '0');
    const td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-' + z(n.getDate());
    window._FINOFF = 0;
    window.FINX = { ready: true,
      accounts: [{ id: 'B', name: 'Карта', kind: 'card', opening_balance: 1000000, sort: 1 },
                 { id: 'R', name: 'Резерв', kind: 'bank', opening_balance: 2000000, is_reserve: true, sort: 2 }],
      ops: [ { id: 'i', op_date: td, kind: 'income',  amount: 5000000, account_id: 'B', category: 'Оплата клиента' },
             { id: 'p', op_date: td, kind: 'prepay',  amount: 2000000, account_id: 'B', category: 'Оплата клиента' },
             { id: 'e', op_date: td, kind: 'expense', amount: 3000000, account_id: 'B', category: 'Зарплаты' },
             { id: 't', op_date: td, kind: 'transfer', amount: 900000, account_id: 'B', account_to: 'R' } ] };
    window.FINP = [{ id: 'x', flow: 'out', title: 'Аренда', amount: 100000, every: 'month',
      day_of_month: 10, category: 'Аренда' }];
    window.FINO = []; window.FINS = { reserve_pct: 10 };
    PROJECTS.length = 0; PROJECTS.push({ id: 'a', name: 'APOLO', mrr: 5000000, cost: 2000000, status: 'active' });
    window.FINANCE = { ready: true, totalMrr: 5000000, totalCost: 2000000, profit: 3000000,
      marginPct: 60, costPct: 40, paying: 1, total: 1, avgMrr: 5000000, totalHours: 0,
      services: [], tariffs: [], snapshots: [] };
    renderFinance();
    const root = document.getElementById('content-ag');
    const steps = Array.from(root.querySelectorAll('.fst')).map(e => ({
      n: (e.querySelector('.fst-n') || {}).textContent || '',
      t: (e.querySelector('.fst-t') || {}).textContent || '' }));
    const txt = (root.textContent || '').replace(/\s+/g, ' ');
    return { steps, txt,
      oldToggle: root.querySelectorAll('.fnx-more').length,
      oldPl: root.querySelectorAll('.pl-row, .fin-hero, .fin-grid, .pdist-card, .alloc-bar, .finx').length,
      monNav: root.querySelectorAll('.fst-mon').length,
      mrrTimes: (txt.match(/Плановая прибыль/g) || []).length };
  });
  ok('шаги идут по порядку 1…7 и не перепрыгивают',
    SM.steps.map(s => s.n).join('') === '1234567', SM.steps.map(s => s.n));
  ok('и называются так, как человек про них спрашивает',
    SM.steps.map(s => s.t).join('|') ===
    'Сейчас|Проекты|Месяц|Остаток|Распределение|Следующий месяц|Сравнение', SM.steps.map(s => s.t));
  ok('переключателя «показать остальное» больше нет — режимов не осталось',
    SM.oldToggle === 0, SM.oldToggle);
  ok('плановых блоков по сметам на экране нет ни одного',
    SM.oldPl === 0 && SM.mrrTimes === 0, [SM.oldPl, SM.mrrTimes]);
  ok('месяц переключается ровно в двух местах, где он что-то меняет',
    SM.monNav === 2, SM.monNav);

  console.log('[G4] зона доступа: проект-менеджер видит деньги своих проектов');
  /* У агентства может быть три ПМ на три направления. «Приход агентства» —
     не его число: он отвечает за свои проекты и должен видеть деньги ровно
     по ним. Операции без проекта — аренда, налоги, администрация — в его
     картину не входят: это расходы агентства, а не его проектов.

     ── На бумаге ─────────────────────────────────────────────────────
     Его проект APOLO: пришло 10 000 000, ушло 4 000 000 → остаток 6 000 000.
     Чужой RESTO (30 000 000) и общая аренда (5 000 000) в счёт не идут. */
  const SC = await page.evaluate(() => {
    const n = new Date(), z = v => String(v).padStart(2, '0');
    const td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-' + z(n.getDate());
    window._FINOFF = 0; window._aggLoaded = true;
    window.__me = { id: 'u9', role: 'member', is_pm: true, is_director: false,
      permissions: { projects: { scope: 'assigned' }, finance: { view: true } } };
    window.tMe = () => window.__me;
    PROJECTS.length = 0;
    PROJECTS.push({ id: 'a', name: 'APOLO', status: 'active', mrr: 12000000, cost: 0,
      _team: [{ _id: 'u9' }] });
    PROJECTS.push({ id: 'r', name: 'RESTO', status: 'active', mrr: 30000000, cost: 0, _team: [{ _id: 'u1' }] });
    window.FINX = { ready: true, accounts: [{ id: 'W', name: 'Карта', kind: 'card', opening_balance: 0, sort: 1 }],
      ops: [ { id: '1', op_date: td, kind: 'income',  amount: 10000000, account_id: 'W', project_id: 'a' },
             { id: '2', op_date: td, kind: 'income',  amount: 30000000, account_id: 'W', project_id: 'r' },
             { id: '3', op_date: td, kind: 'expense', amount: 4000000,  account_id: 'W', project_id: 'a', category: 'Зарплаты' },
             { id: '4', op_date: td, kind: 'expense', amount: 5000000,  account_id: 'W', category: 'Аренда' } ] };
    window.FINP = []; window.FINO = []; window.FINS = {}; window.FINM = [];
    window.FINANCE = { ready: true, projects: PROJECTS, totalMrr: 42000000, totalCost: 0, profit: 42000000,
      marginPct: 100, costPct: 0, paying: 2, total: 2, avgMrr: 21000000, totalHours: 40,
      services: [], tariffs: [], snapshots: [] };
    renderFinance();
    const root = document.getElementById('content-ag');
    const nums = [...root.querySelectorAll('.fst-3 .fst-c')].map(e => ({
      l: (e.querySelector('.l') || {}).textContent || '',
      v: ((e.querySelector('.v') || {}).textContent || '').replace(/\s/g, '') }));
    const out = { steps: [...root.querySelectorAll('.fst-n')].map(e => e.textContent),
      warn: (root.querySelector('.fst-warn') || {}).textContent || '',
      rows: [...root.querySelectorAll('.fnx-fc:not(.hd):not(.tot) .fnx-fc-nm')].map(e => e.textContent),
      money: root.querySelectorAll('.fnx-hero').length,
      nums: nums,
      avg: nums.filter(x => /Средний чек|Время/.test(x.l)).length };
    window.__me = null; window.tMe = () => null; window._aggLoaded = false;
    return out;
  });
  ok('остаются только шаги про проекты: 2, 3 и 7',
    SC.steps.join('') === '237', SC.steps);
  ok('счета агентства ему не показывают вовсе', SC.money === 0, SC.money);
  ok('и сказано, почему их нет, а не оставлено гадать',
    /только по вашим проектам/.test(SC.warn) && /владельцу и директору/.test(SC.warn), SC.warn);
  ok('в таблице только его проект', SC.rows.join(',') === 'APOLO', SC.rows);
  const scv = l => (SC.nums.filter(x => new RegExp(l).test(x.l))[0] || {}).v;
  ok('приход 10 000 000: чужие 30 000 000 в его число не входят',
    scv('^Приход$') === '+10000000сум', SC.nums);
  ok('расход 4 000 000: общая аренда — расход агентства, не его проектов',
    scv('^Расход$') === '−4000000сум' && scv('Остаток месяца') === '+6000000сум', SC.nums);
  ok('средний чек и время агентства ему не показывают — это чужие числа',
    SC.avg === 0, SC.avg);

  console.log('[H] полоса платежей и «Свободно»');
  const PL = await page.evaluate(() => {
    /* Планы строим от сегодняшнего дня, иначе проверка начнёт зависеть от
       того, какое сегодня число, и сломается не от поломки кода. */
    const z = v => String(v).padStart(2, '0');
    const dd = k => { const d = new Date(); d.setDate(d.getDate() + k);
      return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
    window.FINX = { ready: true,
      accounts: [{ id: 'W', name: 'Карта', kind: 'card', opening_balance: 3000000, sort: 1 }],
      ops: [] };
    window.FINP = [];
    const noPlans = finPlanBlock();
    window.FINP = [
      { id: 'p1', flow: 'out', title: 'Зарплаты', amount: 5000000, every: 'once', due_date: dd(3) },
      { id: 'p2', flow: 'in',  title: 'Клиент',   amount: 9000000, every: 'once', due_date: dd(6) },
      { id: 'p3', flow: 'out', title: 'Аренда',   amount: 1000000, every: 'once', due_date: dd(9) } ];
    /* Планы уехали в шаг 6 и в блок денег больше не вклеиваются: раньше
       один блок рисовал пять чужих. Собираем оба и проверяем как было. */
    const d = document.createElement('div'); d.innerHTML = finMoneyBlock() + finPlanBlock();
    const rows = Array.from(d.querySelectorAll('.fnx-pr:not(.hd)'));
    const f = finFreeNow();
    const cell = (r, s) => (r.querySelector(s) || {}).textContent || '';
    return {
      noPlans: /Собрать из своих данных/.test(noPlans) && /fnx-pl-empty/.test(noPlans),
      rows: rows.length,
      bad: d.querySelectorAll('.fnx-pr.bad').length,
      bals: rows.map(r => cell(r, '.fnx-pr-b').replace(/\s/g, '')),
      free: f.free, solo: f.freeSolo, gap: f.gapDate, gapAmt: f.gapAmt,
      card: (d.querySelector('.fnx-h-free') || {}).textContent || '',
      cardBad: !!d.querySelector('.fnx-h-free.bad'),
      dep: f.dependsOn.length };
  });
  /* На бумаге: 3 000 000 − 5 000 000 = −2 000 000 (разрыв), +9 000 000 =
     7 000 000, −1 000 000 = 6 000 000. Свободно 0, без поступления тоже 0. */
  ok('без планов — приглашение собрать их, а не пустое место', PL.noPlans, PL.noPlans);
  ok('в полосе три строки', PL.rows === 3, PL.rows);
  ok('остатки в полосе — те же, что в прогоне: −2 000 000, 7 000 000, 6 000 000',
    PL.bals.join('|') === '−2000000|7000000|6000000', PL.bals);
  ok('день, когда денег не хватит, подсвечен', PL.bad === 1, PL.bad);
  ok('разрыв назван датой и суммой', !!PL.gap && PL.gapAmt === 2000000, [PL.gap, PL.gapAmt]);
  ok('«Свободно» ноль и карточка красная', PL.free === 0 && PL.cardBad, [PL.free, PL.cardBad]);
  ok('в карточке написано, на каком поступлении держится расчёт',
    PL.dep === 1 && /Держится на 1 поступлении/.test(PL.card), [PL.dep, PL.card]);

  console.log('[I] оплата плана — это проводка, а не галочка');
  const PY2 = await page.evaluate(async () => {
    let sent = null; window.tFinSaveOp = r => { sent = r; return Promise.resolve(); };
    const said = []; const _t = window.toast; window.toast = m => said.push(m);
    const per = window.FINP[0].due_date;
    finPayPlan('p1', per);
    await new Promise(r => setTimeout(r, 140));
    const amt = (document.getElementById('fnx-o-am') || {}).value || '';
    const warn = (document.querySelector('#fnx-op-b .fnx-warn') || {}).textContent || '';
    window._finDupOk = false; finOpSave();
    const first = sent;
    /* Следующая операция — обычная: привязка к плану не должна за ней тянуться. */
    finOpOpen('expense');
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
    set('fnx-o-am', '10 000'); window._finDupOk = false; finOpSave();
    window.toast = _t;
    return { amt: amt.replace(/\s/g, ''), warn, first, second: sent, said };
  });
  ok('сумма подставлена из плана', PY2.amt === '5000000', PY2.amt);
  ok('и сказано, какой план это закрывает', /Закрывает план/.test(PY2.warn), PY2.warn);
  ok('операция уходит со ссылкой на план и период',
    !!PY2.first && PY2.first.plan_id === 'p1' && !!PY2.first.plan_period, PY2.first);
  ok('следующая обычная операция чужой план не закрывает',
    !!PY2.second && !PY2.second.plan_id, PY2.second);

  console.log('[J] сверка: разницу считает модуль, а не человек');
  /* Тип операции «излишек / недостача» был и раньше, но вычитать учётный
     остаток из фактического приходилось в уме — ровно там и ошибаются. */
  await seed();
  const RC = await page.evaluate(async () => {
    let sent = null; window.tFinSaveOp = r => { sent = r; return Promise.resolve(); };
    const said = []; const _t = window.toast; window.toast = m => said.push(m);
    const out = () => (document.getElementById('fnx-rc-out') || {}).textContent || '';
    finRecOpen('B');                                   // по учёту 6 500 000
    const shown = (document.getElementById('fnx-rc-am') || {}).value.replace(/\s/g, '');
    const same = out();
    const set = v => { const e = document.getElementById('fnx-rc-am'); e.value = v; finRecCalc(); };
    set('6 300 000'); const less = out();
    set('6 900 000'); const more = out();
    finRecSave();                                      // без причины
    const noWhy = said.slice();
    document.getElementById('fnx-rc-nt').value = 'сдача не записана';
    finRecSave();
    const surplus = sent;
    finRecOpen('B'); set('6 200 000');
    document.getElementById('fnx-rc-nt').value = 'потеряли чек';
    finRecSave();
    window.toast = _t;
    return { shown, same, less, more, noWhy, surplus, shortage: sent,
      hint: (document.querySelector('#ov-fin .fnx-hint') || {}).textContent || '' };
  });
  ok('в поле сразу стоит учётный остаток — сверяют с ним', RC.shown === '6500000', RC.shown);
  ok('пока цифры равны — «сходится», а не пустота', /Сходится/.test(RC.same), RC.same);
  ok('меньше учётного — недостача 200 000', /Недостача/.test(RC.less) && /200 000/.test(RC.less), RC.less);
  ok('больше — излишек 400 000', /Излишек/.test(RC.more) && /400 000/.test(RC.more), RC.more);
  ok('без объяснения корректировка не проходит', /Без объяснения/.test(RC.noWhy[0] || ''), RC.noWhy);
  ok('излишек уходит как «излишек при сверке» ровно на разницу',
    RC.surplus && RC.surplus.kind === 'adjust_in' && RC.surplus.amount === 400000, RC.surplus);
  ok('недостача — как «недостача», тоже на разницу',
    RC.shortage && RC.shortage.kind === 'adjust_out' && RC.shortage.amount === 300000, RC.shortage);
  ok('причина уходит в запись, а не теряется',
    /потеряли чек/.test((RC.shortage && RC.shortage.note) || ''), RC.shortage);
  ok('и рядом сказано, что сверка — последнее средство, а не первое',
    /внесите её обычной записью/.test(RC.hint), RC.hint);

  await page.evaluate(() => { const d = document.getElementById('fnx-probe'); if (d) d.remove(); finClose(); });
  console.log(errs.length ? 'ОШИБКИ: ' + JSON.stringify(errs.slice(0, 3)) : '');
  ok('страница не бросила ни одной ошибки', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(`\n${pass} ok · ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
