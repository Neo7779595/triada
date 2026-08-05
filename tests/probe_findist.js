/* probe_findist — распределение остатка месяца.

   Раньше распределение прибыли жило в localStorage: у каждого браузера были
   свои проценты, а рядом, в базе, лежали совладельцы с другими долями. Два
   ответа на один вопрос — и ни одного правильного. Теперь доля одна, и
   распределение не рисует картинку, а записывает операции.

   ── Расклад ─────────────────────────────────────────────────────────
   Счета: Карта (оборотный), Резерв (назначение reserve), Фонд (charity).
   За месяц: оплата клиента 20 000 000, расход 8 000 000.
   Доли: владельцам 40%, в резерв 20%, на благотворительность 5%.
   Совладельцы: Нурислам 60%, Партнёр 40%.

   ── На бумаге ───────────────────────────────────────────────────────
   Остаток месяца     = 20 000 000 − 8 000 000 = 12 000 000
   Владельцам   40%   =  4 800 000   → Нурислам 2 880 000, Партнёр 1 920 000
   В резерв     20%   =  2 400 000
   Фонд          5%   =    600 000
   Активный баланс    = 12 000 000 − 4 800 000 − 2 400 000 − 600 000
                      =  4 200 000, это и есть оставшиеся 35%
   Физически уйдёт со счетов 4 800 000 + 2 400 000 + 600 000 = 7 800 000.
   На оборотных 12 000 000 — хватает.

   Активный баланс нарочно не доля, а остаток: тогда сумма всегда сходится
   к остатку месяца, а состояние «проценты не сошлись» становится
   невозможным. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  const seed = () => page.evaluate(() => {
    const z = v => String(v).padStart(2, '0');
    const n = new Date(), td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-' + z(n.getDate());
    window._FINOFF = 0;
    window.__me = { id: 'u1', role: 'agency_owner' }; window.tMe = () => window.__me;
    window.FINX = { ready: true, accounts: [
      { id: 'W', name: 'Карта', kind: 'card', opening_balance: 0, sort: 1 },
      { id: 'R', name: 'Резерв', kind: 'bank', opening_balance: 0, purpose: 'reserve', is_reserve: true, sort: 2 },
      { id: 'C', name: 'Фонд', kind: 'bank', opening_balance: 0, purpose: 'charity', sort: 3 }],
      ops: [ { id: 'i', op_date: td, kind: 'income', amount: 20000000, account_id: 'W', category: 'Оплата клиента' },
             { id: 'e', op_date: td, kind: 'expense', amount: 8000000, account_id: 'W', category: 'Зарплаты' } ] };
    window.FINP = []; window.FINM = [];
    window.FINO = [{ id: 'o1', name: 'Нурислам', share_pct: 60, sort: 1 },
                   { id: 'o2', name: 'Партнёр',  share_pct: 40, sort: 2 }];
    window.FINS = { owners_pct: 40, reserve_pct: 20, charity_pct: 5, reserve_target_months: 3 };
    PROJECTS.length = 0;
    return true;
  });
  await seed();

  console.log('[A] арифметика долей');
  const M = await page.evaluate(() => {
    const d = finDistNow();
    return { rest: d.rest, own: d.owners, res: d.reserve, cha: d.charity, act: d.active,
      pAct: d.pctActive, rows: d.rows.map(r => ({ n: r.name, a: r.amount })),
      move: d.move, cap: d.cap, enough: d.enough, short: d.short };
  });
  ok('остаток месяца 12 000 000 — приход минус расход', M.rest === 12000000, M.rest);
  ok('владельцам 40% — 4 800 000', M.own === 4800000, M.own);
  ok('в резерв 20% — 2 400 000', M.res === 2400000, M.res);
  ok('на благотворительность 5% — 600 000', M.cha === 600000, M.cha);
  ok('активный баланс — остаток, а не доля: 4 200 000 и это 35%',
    M.act === 4200000 && M.pAct === 35, [M.act, M.pAct]);
  ok('четыре части в сумме дают ровно остаток месяца',
    M.own + M.res + M.cha + M.act === M.rest, [M.own, M.res, M.cha, M.act]);
  ok('доля владельца считается внутри общей доли: 2 880 000 и 1 920 000',
    M.rows[0].a === 2880000 && M.rows[1].a === 1920000, M.rows);
  ok('со счетов уйдёт 7 800 000, а 4 200 000 останутся на обороте',
    M.move === 7800000, M.move);
  ok('на оборотных 12 000 000 — хватает', M.cap === 12000000 && M.enough === true && M.short === 0, M);

  console.log('[B] округление никого не обделяет');
  /* Три равные доли от миллиона дают 333 333 каждому и теряют рубль.
     Потерянное отдаём первой из крупнейших долей, а не выбрасываем: сумма
     частей обязана равняться целому, иначе таблица не сойдётся. */
  const R = await page.evaluate(() => {
    const d = finDistMath(2500000, [{ id: 'a', name: 'A', share_pct: 1 },
      { id: 'b', name: 'B', share_pct: 1 }, { id: 'c', name: 'C', share_pct: 1 }],
      { owners_pct: 40, reserve_pct: 0, charity_pct: 0 }, 99000000);
    return { own: d.owners, rows: d.rows.map(r => r.amount),
      sum: d.rows.reduce((s, r) => s + r.amount, 0), act: d.active };
  });
  ok('доля владельцев 1 000 000 делится на троих без потери рубля',
    R.own === 1000000 && R.sum === 1000000, R);
  ok('лишний рубль ушёл в первую долю, а не пропал',
    R.rows.join(',') === '333334,333333,333333', R.rows);
  ok('активный баланс забрал остальные 60%: 1 500 000', R.act === 1500000, R.act);

  console.log('[C] отложенное в этом месяце не откладывается второй раз');
  /* Живой случай владельца. Резерв 20% от остатка 12 000 000 это 2 400 000.
     Если 2 000 000 уже переведены кнопкой «отложить» из шага «Резерв», то
     перевести осталось 400 000, а не 2 400 000 ещё раз: иначе в резерве
     окажется 4 400 000 при правиле 2 400 000, и на эти же деньги обделят
     владельцев. Шаг «Резерв» вычитание уже делал; распределение считало
     долю с нуля — и одно число на двух экранах было разным.

     ── На бумаге ─────────────────────────────────────────────────────
     Остаток 12 000 000. Владельцам 40% = 4 800 000, резерв 20% =
     2 400 000, фонд 5% = 600 000. Переведено вручную 2 000 000.
     Перевести в резерв осталось 2 400 000 − 2 000 000 = 400 000.
     Со счетов уйдёт 4 800 000 + 400 000 + 600 000 = 5 800 000.
     На обороте после перевода 12 000 000 − 2 000 000 = 10 000 000 —
     хватает. */
  const S = await page.evaluate(() => {
    const z = v => String(v).padStart(2, '0');
    const n = new Date(), td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-' + z(n.getDate());
    window.FINX.ops = window.FINX.ops.concat([
      { id: 't', op_date: td, kind: 'transfer', amount: 2000000, account_id: 'W', account_to: 'R' }]);
    const d = finDistNow();
    const r = finReserveMath(window.FINX.accounts, window.FINX.ops, window.FINS,
      { from: td.slice(0, 8) + '01', to: td.slice(0, 8) + '28', today: td });
    const box = document.createElement('div'); box.innerHTML = finStepDist();
    const карточка = [...box.querySelectorAll('.fdi-c')]
      .filter(c => /Резерв/.test((c.querySelector('.l') || {}).textContent || ''))[0];
    finDistOpen();
    const строка = ((window._FINDIST || {}).lines || []).filter(l => l.k === 'res')[0] || null;
    finClose();
    return { rest: d.rest, доля: d.reserve, уже: d.movedReserve, перевести: d.reserveMove,
      move: d.move, cap: d.cap, enough: d.enough, short: d.short,
      долг_в_шаге_резерв: r.owe,
      подпись: карточка ? (карточка.querySelector('.s') || {}).textContent : '',
      запишется: строка ? строка.amount : null };
  });
  ok('перевод в резерв остаток месяца не трогает — деньги не потрачены',
    S.rest === 12000000, S.rest);
  ok('доля резерва по-прежнему 2 400 000 — правило не изменилось', S.доля === 2400000, S.доля);
  ok('но перевести осталось 400 000, а не всю долю заново',
    S.перевести === 400000 && S.уже === 2000000, S);
  ok('и это ровно то число, что показывает шаг «Резерв» — одно на двух экранах',
    S.перевести === S.долг_в_шаге_резерв, [S.перевести, S.долг_в_шаге_резерв]);
  ok('в запись уйдёт 400 000, а не 2 400 000', S.запишется === 400000, S.запишется);
  ok('человеку сказано, почему сумма меньше доли',
    /уже переведено 2 000 000/.test(S.подпись) && /осталось 400 000/.test(S.подпись), S.подпись);
  ok('со счетов уйдёт 5 800 000, и на обороте 10 000 000 — хватает',
    S.move === 5800000 && S.cap === 10000000 && S.enough === true && S.short === 0, S);

  console.log('[C2] нехватку объясняют настоящей причиной');
  /* Раньше сообщение всегда называло одну причину — «это то, что не пришло
     от клиентов». Так не бывает: остаток месяца считается по кассе, приход
     это уже полученные деньги, и неоплаченный счёт остаток не раздувает
     вовсе. Разойтись остаток и оборотные могут только от отложенного и от
     движений мимо прибыли. */
  const WHY = await page.evaluate(() => {
    const z = v => String(v).padStart(2, '0');
    const n = new Date(), td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-' + z(n.getDate());
    const базовые = window.FINX.ops.filter(o => o.id === 'i' || o.id === 'e');
    const текст = () => { const b = document.createElement('div'); b.innerHTML = finStepDist();
      return ((b.querySelector('.fnx-fc-cov.thin') || {}).textContent || '').replace(/\s+/g, ' ').trim(); };

    /* Клиенты заплатили всё, но 9 000 000 лежат в резерве.
       Остаток 12 000 000, доли 40/20/5. Резерв уже покрыт с запасом, значит
       переводить в него нечего: уйдёт 4 800 000 владельцам и 600 000 в фонд
       = 5 400 000. На обороте 12 000 000 − 9 000 000 = 3 000 000.
       Не хватает 5 400 000 − 3 000 000 = 2 400 000. */
    window.FINX.ops = базовые.concat([
      { id: 't2', op_date: td, kind: 'transfer', amount: 9000000, account_id: 'W', account_to: 'R' }]);
    const отложено = текст(); const d1 = finDistNow();

    /* Ничего не откладывали, но собственник забрал 5 000 000. Изъятие не
       расход: остаток месяца по-прежнему 12 000 000, а на счетах 7 000 000.
       Уйти должно 7 800 000 — не хватает 800 000. */
    window.FINX.ops = базовые.concat([
      { id: 'ow', op_date: td, kind: 'owner_out', amount: 5000000, account_id: 'W', owner_id: 'o1' }]);
    const мимо = текст(); const d2 = finDistNow();

    return { отложено, мимо, short1: d1.short, short2: d2.short, cap2: d2.cap, move2: d2.move };
  });
  ok('деньги в резерве — так и сказано, и названа сумма',
    /на отложенных счетах лежит/.test(WHY.отложено) && /9 000 000/.test(WHY.отложено),
    WHY.отложено.slice(0, 260));
  ok('в резерв при этом больше не переводят — доля уже покрыта', WHY.short1 === 2400000, WHY.short1);
  ok('про должников не сказано ни слова: остаток считается по кассе',
    !/клиент/i.test(WHY.отложено) && !/Не пришло/.test(WHY.отложено), WHY.отложено.slice(0, 260));
  ok('изъятие собственника названо своим именем, а не неоплатой',
    /ушло мимо прибыли/.test(WHY.мимо) && /5 000 000/.test(WHY.мимо), WHY.мимо.slice(0, 260));
  ok('и арифметика сходится: 7 800 000 при обороте 7 000 000 — не хватает 800 000',
    WHY.move2 === 7800000 && WHY.cap2 === 7000000 && WHY.short2 === 800000, WHY);

  await seed();

  console.log('[D] месяц в минусе');
  const Z = await page.evaluate(() => {
    const d = finDistMath(-3000000, [{ id: 'a', name: 'A', share_pct: 100 }],
      { owners_pct: 40, reserve_pct: 20, charity_pct: 5 }, 50000000);
    return { rest: d.rest, own: d.owners, res: d.reserve, cha: d.charity, act: d.active, move: d.move };
  });
  ok('из минуса не делают ноль долей, а делают ноль сумм',
    Z.rest === 0 && Z.own === 0 && Z.res === 0 && Z.cha === 0 && Z.act === 0 && Z.move === 0, Z);

  console.log('[E] предпросмотр: что именно будет записано');
  await seed();
  const P = await page.evaluate(() => {
    finDistOpen();
    const rows = [...document.querySelectorAll('#ov-fin .fnx-dl:not(.sum)')].map(e => ({
      t: (e.querySelector('.fnx-dl-t') || {}).firstChild.textContent,
      v: ((e.querySelector('.fnx-dl-v') || {}).textContent || '').replace(/\s/g, ''),
      on: !!e.querySelector('.fnx-ck.on'), off: e.classList.contains('off') }));
    const sums = [...document.querySelectorAll('#ov-fin .fnx-dl.sum .fnx-dl-v')]
      .map(e => e.textContent.replace(/\s/g, ''));
    return { rows, sums };
  });
  ok('в списке четыре строки: резерв, фонд и две выплаты', P.rows.length === 4, P.rows);
  ok('переводы в фонды отмечены сразу — деньги остаются нашими',
    P.rows[0].on === true && P.rows[1].on === true, P.rows);
  ok('выплаты владельцам не отмечены: доля посчитана, но из кассы могли не выдавать',
    P.rows[2].on === false && P.rows[3].on === false, P.rows);
  ok('и суммы в строках те же, что на экране', P.rows[0].v === '2400000' && P.rows[1].v === '600000'
    && P.rows[2].v === '2880000' && P.rows[3].v === '1920000', P.rows.map(r => r.v));
  ok('итог считает только отмеченное: уйдёт 3 000 000, останется 9 000 000',
    P.sums[0] === '3000000' && P.sums[1] === '9000000', P.sums);

  const T = await page.evaluate(() => {
    finDistToggle('own:o1');
    const sums = [...document.querySelectorAll('#ov-fin .fnx-dl.sum .fnx-dl-v')]
      .map(e => e.textContent.replace(/\s/g, ''));
    return sums;
  });
  ok('отметили выплату — итог вырос на её сумму: 5 880 000 и 6 120 000',
    T[0] === '5880000' && T[1] === '6120000', T);

  console.log('[F] без счёта-фонда строку не отмечают, а объясняют');
  const NF = await page.evaluate(() => {
    window.FINX.accounts = window.FINX.accounts.filter(a => a.id !== 'C');
    finDistOpen();
    const rows = [...document.querySelectorAll('#ov-fin .fnx-dl:not(.sum)')].map(e => ({
      t: (e.querySelector('.fnx-dl-t') || {}).textContent, off: e.classList.contains('off'),
      on: !!e.querySelector('.fnx-ck.on') }));
    return rows.filter(r => /благотвор/i.test(r.t))[0] || null;
  });
  ok('строка фонда есть, но не отмечена и не кликается', NF && NF.off === true && NF.on === false, NF);
  ok('и сказано, чего не хватает', NF && /не заведён/.test(NF.t), NF && NF.t);

  console.log('[G] запись уходит одной пачкой с общей меткой месяца');
  const W = await page.evaluate(async () => {
    const sent = { month: null, ops: [] };
    window.tFinSaveMonth = async r => { sent.month = r; return 'MC1'; };
    window.tFinSaveOp = async r => { sent.ops.push(r); };
    window._finReload = () => {};
    window.FINX.accounts.push({ id: 'C', name: 'Фонд', kind: 'bank', opening_balance: 0, purpose: 'charity', sort: 3 });
    finDistOpen(); finDistToggle('own:o1');
    finDistGo();
    await new Promise(r => setTimeout(r, 250));
    return sent;
  });
  ok('месяц записан с остатком и приходом', W.month && W.month.rest === 12000000
    && W.month.income === 20000000 && W.month.expense === 8000000, W.month);
  ok('операций три: два перевода и одна выплата', W.ops.length === 3, W.ops.map(o => o.kind));
  ok('все несут одну метку закрытия — отменяются одним действием',
    W.ops.every(o => o.month_close_id === 'MC1'), W.ops.map(o => o.month_close_id));
  ok('резерв и фонд ушли переводами между своими счетами',
    W.ops[0].kind === 'transfer' && W.ops[0].account_to === 'R'
    && W.ops[1].kind === 'transfer' && W.ops[1].account_to === 'C', W.ops.slice(0, 2));
  ok('выплата владельцу — изъятие с указанием, кому',
    W.ops[2].kind === 'owner_out' && W.ops[2].owner_id === 'o1' && W.ops[2].amount === 2880000, W.ops[2]);

  console.log('[H] отмена требует причину и не удаляет ничего');
  const U = await page.evaluate(async () => {
    const z = v => String(v).padStart(2, '0');
    const n = new Date(), per = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-01';
    window.FINM = [{ id: 'MC1', period: per, rest: 12000000, closed_at: n.toISOString() }];
    const box = document.createElement('div'); box.innerHTML = finStepDist();
    const closedLbl = (box.textContent || '').replace(/\s+/g, ' ');
    let got = null; window.tFinUndoMonth = async (id, reason) => { got = { id, reason }; };
    window.toast = m => { window.__t = m; };
    finDistUndo(); finDistUndoGo('MC1');            // без причины — не проходит
    const blocked = got === null;
    document.getElementById('fnx-du-r').value = 'ошиблись в долях';
    finDistUndoGo('MC1');
    await new Promise(r => setTimeout(r, 120));
    return { closedLbl, blocked, got, noBtn: !/Распределить остаток/.test(closedLbl) };
  });
  ok('распределённый месяц помечен и кнопку «распределить» не показывает',
    /Распределено/.test(U.closedLbl) && U.noBtn === true, U.closedLbl.slice(0, 120));
  ok('без причины отмена не проходит', U.blocked === true, U.blocked);
  ok('с причиной — уходит вместе с ней и по метке месяца',
    U.got && U.got.id === 'MC1' && /ошиблись в долях/.test(U.got.reason), U.got);

  console.log(errs.length ? 'ОШИБКИ: ' + JSON.stringify(errs.slice(0, 3)) : '');
  ok('страница не бросила ни одной ошибки', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(`\n${pass} ok · ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
