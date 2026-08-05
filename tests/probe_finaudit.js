/* probe_finaudit — то, что нашёл разбор модуля после пересборки.

   Каждая проверка здесь закрывает воспроизведённый дефект. Их держат
   отдельным файлом нарочно: это не «ещё немного про финансы», а список
   мест, где модуль уже один раз соврал.

   ── На бумаге ───────────────────────────────────────────────────────
   [B] Фонд благотворительности — отложенные деньги, как резерв.
       Карта 0, Резерв 0, Фонд 0. Приход 20 000 000, расход 8 000 000,
       перевод 2 400 000 в резерв и 3 000 000 в фонд.
       Карта  20 000 000 − 8 000 000 − 2 400 000 − 3 000 000 = 6 600 000
       Всего 12 000 000, резерв 2 400 000, фонд 3 000 000
       Оборотные = 12 000 000 − 2 400 000 − 3 000 000 = 6 600 000
       Пока фонд считался оборотным, отложенное каждый месяц снова попадало
       и в «свободно», и в предел распределения — то есть раздавалось второй
       раз.

   [D] Аванс не делится. Приход: оплата 30 000 000 и аванс 10 000 000,
       расход 12 000 000. Остаток месяца 28 000 000, база распределения
       28 000 000 − 10 000 000 = 18 000 000. Разделить аванс как прибыль
       значит через два месяца остаться без денег на его отработку.

   [E] Возврат клиенту — минус к поступлениям, а не расход.
       Альфа: оплата 10 000 000, расход 4 000 000. Бета: оплата 5 000 000
       и возврат 5 000 000. Всё привязано к проектам.
       Поступлений 10 000 000 из 10 000 000 → 100%
       Расходов     4 000 000 из  4 000 000 → 100%
       Раньше выходило 133% привязанных поступлений — невозможное число.

   [G] Округление. 50/25/25 от 9 999 999 дают 5 000 000 + 2 500 000 +
       2 500 000 = 10 000 000 — на рубль больше целого. Лишнее снимаем с
       самой крупной доли: 4 999 999 + 2 500 000 + 2 500 000 + 0.

   [H] Доля владельцев, которую не на кого делить, остаётся на обороте.
       Остаток 12 000 000, доли 40/20/5, два владельца с нулевыми
       процентами: владельцам 0, резерв 2 400 000, фонд 600 000,
       активный баланс 9 000 000.

   [R] Концентрация прихода считается после возвратов.
       APOLO заплатил 45 000 000. Artel заплатил 20 000 000 и получил
       возврат 5 000 000, то есть принёс 15 000 000.
       Приход месяца = 65 000 000 − 5 000 000 = 60 000 000
       Крупнейший — APOLO: 45 000 000 / 60 000 000 = 75%
       От оборота до возвратов выходило 45/65 = 69%: доля крупнейшего
       занижалась ровно тем возвратом, который сделал другой клиент.
       Подпись при этом говорила «доля в приходе», а приход рядом уже
       показан за вычетом — два числа под одним словом.

   [S] «Авансами пришло» — это про месяц, а не про остаток на счетах.
       Аванс 20 000 000 первого числа, расход 18 000 000 в тот же день.
       На счетах 2 000 000, авансами за месяц пришло 20 000 000.
       Прежняя подпись читалась как «есть 2 000 000, из них авансов
       20 000 000» — утверждение, которое не может быть правдой.
       Слова «из них» рядом с авансом теперь нет вовсе. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1400, height: 950 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  console.log('[A] карточки всего продукта не потеряли глубину');
  /* Правило тени было общим для .px-ov, .kpis, .card и одного финансового
     селектора. Чистка мёртвых стилей унесла строку целиком — и тень
     пропала во всех модулях сразу. */
  const SH = await page.evaluate(() => {
    const mk = c => { const e = document.createElement('div'); e.className = c;
      document.body.appendChild(e); const s = getComputedStyle(e).boxShadow; e.remove(); return s; };
    return { card: mk('card'), kpis: mk('kpis'), ov: mk('px-ov') };
  });
  ok('у .card есть тень и светлая кромка, а не none', SH.card !== 'none' && /inset/.test(SH.card), SH.card);
  ok('у .kpis и .px-ov тоже', SH.kpis !== 'none' && SH.ov !== 'none', SH);

  console.log('[B] фонд благотворительности — не оборотные деньги');
  const F = await page.evaluate(() => {
    const z = v => String(v).padStart(2, '0'); const n = new Date();
    const td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-01';
    window.__me = { id: 'u1', role: 'agency_owner' }; window.tMe = () => window.__me;
    window._FINOFF = 0; PROJECTS.length = 0;
    window.FINX = { ready: true, accounts: [
      { id: 'W', name: 'Карта', kind: 'card', opening_balance: 0, sort: 1 },
      { id: 'R', name: 'Резерв', kind: 'bank', opening_balance: 0, purpose: 'reserve', is_reserve: true, sort: 2 },
      { id: 'C', name: 'Фонд', kind: 'bank', opening_balance: 0, purpose: 'charity', sort: 3 }],
      ops: [ { id: '1', op_date: td, kind: 'income',  amount: 20000000, account_id: 'W', category: 'Оплата' },
             { id: '2', op_date: td, kind: 'expense', amount: 8000000,  account_id: 'W', category: 'Зарплаты' },
             { id: '3', op_date: td, kind: 'transfer', amount: 2400000, account_id: 'W', account_to: 'R' },
             { id: '4', op_date: td, kind: 'transfer', amount: 3000000, account_id: 'W', account_to: 'C' } ] };
    window.FINP = []; window.FINO = []; window.FINS = { owners_pct: 40, reserve_pct: 20, charity_pct: 5 };
    window.FINM = [];
    const m = finM(), d = finDistNow(), f = finFreeNow();
    return { total: m.total, reserve: m.reserve, charity: m.charity, working: m.working,
      cap: d.cap, free: f.free };
  });
  ok('всего 12 000 000, из них резерв 2 400 000 и фонд 3 000 000',
    F.total === 12000000 && F.reserve === 2400000 && F.charity === 3000000, F);
  ok('оборотные — 6 600 000: фонд из них вычтен', F.working === 6600000, F.working);
  ok('предел распределения и «свободно» тоже 6 600 000, а не 9 600 000',
    F.cap === 6600000 && F.free === 6600000, F);

  console.log('[C] проводки распределения не уходят со счёта-фонда');
  const WA = await page.evaluate(() => {
    window.FINX.accounts = [
      { id: 'C', name: 'Фонд', kind: 'bank', opening_balance: 0, purpose: 'charity', sort: 1 },
      { id: 'W', name: 'Карта', kind: 'card', opening_balance: 0, purpose: 'active', sort: 2 },
      { id: 'R', name: 'Резерв', kind: 'bank', opening_balance: 0, purpose: 'reserve', is_reserve: true, sort: 3 }];
    finDistOpen();
    const D = window._FINDIST;
    const res = { work: (D && D.lines[0] && D.lines[0].op) ? D.lines[0].op.account_id : null,
      self: (D || { lines: [] }).lines.filter(l => l.op && l.op.account_id === l.op.account_to).length };
    finClose(); return res;
  });
  ok('оборотным выбран счёт развития, а не фонд', WA.work === 'W', WA.work);
  ok('перевода самому себе не возникает', WA.self === 0, WA.self);

  console.log('[D] аванс не делится как прибыль');
  const AD = await page.evaluate(() => {
    const z = v => String(v).padStart(2, '0'); const n = new Date();
    const td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-01';
    window.FINX = { ready: true, accounts: [{ id: 'W', name: 'Карта', kind: 'card', opening_balance: 0, sort: 1 }],
      ops: [ { id: '1', op_date: td, kind: 'income',  amount: 30000000, account_id: 'W' },
             { id: '2', op_date: td, kind: 'prepay',  amount: 10000000, account_id: 'W' },
             { id: '3', op_date: td, kind: 'expense', amount: 12000000, account_id: 'W' } ] };
    window.FINO = [{ id: 'o', name: 'Н', share_pct: 100 }];
    const m = finMonthNow(), d = finDistNow();
    const box = document.createElement('div'); box.innerHTML = finStepDist();
    return { rest: m.rest, adv: m.advance, base: m.distBase, dRest: d.rest,
      own: d.owners, note: (box.textContent || '').replace(/\s+/g, ' ') };
  });
  ok('остаток месяца 28 000 000 — аванс из кассы не выкидывается', AD.rest === 28000000, AD.rest);
  ok('но базой распределения становится 18 000 000',
    AD.adv === 10000000 && AD.base === 18000000 && AD.dRest === 18000000, AD);
  ok('владельцам 40% от базы — 7 200 000, а не от кассы', AD.own === 7200000, AD.own);
  ok('и сказано, почему база меньше остатка',
    /вычтены авансы/.test(AD.note) && /работой, которой ещё не было|работу, которой ещё не было/.test(AD.note), AD.note.slice(0, 260));

  console.log('[E] возврат клиенту — минус к поступлениям, а не расход');
  const CV = await page.evaluate(() => {
    const z = v => String(v).padStart(2, '0'); const n = new Date();
    const td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-01';
    PROJECTS.length = 0;
    PROJECTS.push({ id: 'a', name: 'Альфа', status: 'active', mrr: 10000000, cost: 0 });
    PROJECTS.push({ id: 'b', name: 'Бета',  status: 'active', mrr: 5000000,  cost: 0 });
    const ops = [
      { id: '1', op_date: td, kind: 'income',     amount: 10000000, account_id: 'W', project_id: 'a' },
      { id: '2', op_date: td, kind: 'expense',    amount: 4000000,  account_id: 'W', project_id: 'a' },
      { id: '3', op_date: td, kind: 'income',     amount: 5000000,  account_id: 'W', project_id: 'b' },
      { id: '4', op_date: td, kind: 'refund_out', amount: 5000000,  account_id: 'W', project_id: 'b' }];
    const f = finFactMath(PROJECTS, ops, { from: td.slice(0, 8) + '01', to: td.slice(0, 8) + '28', today: td });
    return { inPct: f.cover.inPct, outPct: f.cover.outPct,
      beta: (f.rows.filter(r => r.name === 'Бета')[0] || {}).got };
  });
  ok('привязанных поступлений 100%, а не 133%', CV.inPct === 100, CV.inPct);
  ok('расходов тоже 100% — таблица не помечается неполной зря', CV.outPct === 100, CV.outPct);
  ok('в самой строке проекта возврат по-прежнему обнуляет пришедшее', CV.beta === 0, CV.beta);

  console.log('[F] лицевые счета владельцев не считают будущее');
  const OW = await page.evaluate(() => {
    const z = v => String(v).padStart(2, '0');
    const d = k => { const x = new Date(); x.setDate(x.getDate() + k);
      return x.getFullYear() + '-' + z(x.getMonth() + 1) + '-' + z(x.getDate()); };
    window.FINX = { ready: true, accounts: [{ id: 'W', name: 'Карта', kind: 'card', opening_balance: 0, sort: 1 }],
      ops: [ { id: '1', op_date: d(0), kind: 'income', amount: 10000000, account_id: 'W' },
             { id: '2', op_date: d(3), kind: 'income', amount: 5000000,  account_id: 'W' } ] };
    window.FINO = [{ id: 'o', name: 'Нурислам', share_pct: 100 }];
    return { profit: finOwnersNow().m.profit, bal: finM().total };
  });
  ok('прибыль к разделу 10 000 000 — как и деньги на счетах',
    OW.profit === 10000000 && OW.bal === 10000000, OW);

  console.log('[G] округление долей не выдаёт больше целого');
  const RD = await page.evaluate(() => {
    const d = finDistMath(9999999, [{ id: 'a', name: 'A', share_pct: 100 }],
      { owners_pct: 50, reserve_pct: 25, charity_pct: 25 }, 99000000);
    return { own: d.owners, res: d.reserve, cha: d.charity, act: d.active, rest: d.rest,
      sum: d.owners + d.reserve + d.charity + d.active, row: d.rows[0].amount };
  });
  ok('четыре части в сумме дают ровно 9 999 999, а не 10 000 000',
    RD.sum === 9999999 && RD.rest === 9999999, RD);
  ok('лишний рубль снят с самой крупной доли: владельцам 4 999 999',
    RD.own === 4999999 && RD.row === 4999999, RD);

  console.log('[H] долю, которую не на кого делить, не начисляют');
  const OR = await page.evaluate(() => {
    const d = finDistMath(12000000, [{ id: 'a', name: 'A', share_pct: 0 }, { id: 'b', name: 'B', share_pct: 0 }],
      { owners_pct: 40, reserve_pct: 20, charity_pct: 5 }, 99000000);
    return { own: d.owners, act: d.active, orphan: d.ownersOrphan,
      sum: d.owners + d.reserve + d.charity + d.active };
  });
  ok('владельцам 0, а 4 800 000 остались в активном балансе: 9 000 000',
    OR.own === 0 && OR.act === 9000000 && OR.sum === 12000000, OR);
  ok('и это помечено отдельно, а не выглядит как настройка', OR.orphan === true, OR.orphan);

  console.log('[I] клик по статье расхода действительно фильтрует журнал');
  const CT = await page.evaluate(() => {
    const z = v => String(v).padStart(2, '0'); const n = new Date();
    const td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-01';
    window.FINX = { ready: true, accounts: [{ id: 'W', name: 'Карта', kind: 'card', opening_balance: 0, sort: 1 }],
      ops: [ { id: '1', op_date: td, kind: 'income',  amount: 30000000, account_id: 'W', category: 'Оплата' },
             { id: '2', op_date: td, kind: 'expense', amount: 5000000,  account_id: 'W', category: 'Аренда' },
             { id: '3', op_date: td, kind: 'expense', amount: 7000000,  account_id: 'W', category: 'Зарплаты' },
             { id: '4', op_date: td, kind: 'expense', amount: 2000000,  account_id: 'W', category: 'Реклама' } ] };
    window.FINP = [];
    const host = document.createElement('div'); host.id = 'fin-ct-host';
    host.innerHTML = finStepMonth(); document.body.appendChild(host);
    const row = [...host.querySelectorAll('.fcat.clk')]
      .filter(e => /Зарплаты/.test(e.textContent))[0];
    row.click();
    const rows = document.querySelectorAll('#fnx-log-b .fnx-row').length;
    const q = (window.FIN_LOG || {}).q;
    host.remove(); finClose();
    return { q, rows, onWindow: typeof window.FIN_LOG !== 'undefined' };
  });
  ok('фильтр журнала виден коду окна', CT.onWindow === true, CT.onWindow);
  ok('в журнал уходит именно та статья', CT.q === 'Зарплаты', CT.q);
  ok('и остаётся одна операция из четырёх', CT.rows === 1, CT.rows);

  console.log('[J] кнопка «Настроить» работает с любым идентификатором проекта');
  const ID = await page.evaluate(() => {
    PROJECTS.length = 0;
    PROJECTS.push({ id: 'zeta', name: 'Зета', status: 'active', mrr: 12000000, cost: 0 });
    window.FINP = []; window.FINANCE = { ready: true, projects: PROJECTS, totalMrr: 12000000,
      totalCost: 0, profit: 12000000, marginPct: 100, costPct: 0, paying: 1, total: 1,
      avgMrr: 12000000, totalHours: 0, services: [], tariffs: [], snapshots: [] };
    const d = document.createElement('div'); d.innerHTML = finStepProjects();
    const btn = d.querySelector('.fst-warn button');
    const attr = btn ? btn.getAttribute('onclick') : '';
    let opened = null; const real = window.finEcoOpen;
    window.finEcoOpen = id => { opened = id; };
    try { new Function(attr)(); } catch (e) { opened = 'THROW:' + e.message; }
    window.finEcoOpen = real;
    return { attr, opened };
  });
  ok('в кнопку подставлен целый идентификатор, а не его hex-остаток',
    ID.opened === 'zeta', [ID.attr, ID.opened]);

  console.log('[K] «Следующий месяц»: итог живой, а без базы — понятная фраза');
  const NX = await page.evaluate(async () => {
    window.FINP = [
      { id: 'p1', flow: 'in',  title: 'Абонплата', amount: 20000000, every: 'month', day_of_month: 12 },
      { id: 'p2', flow: 'out', title: 'Зарплаты',  amount: 8000000,  every: 'month', day_of_month: 5 }];
    finNextOpen(); finNextMode(1, 'change');
    const inp = document.getElementById('fnx-nx-a1');
    inp.value = '18 000 000';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    const live = document.querySelector('#fnx-nx-sum .fnx-nx-v').textContent.replace(/\s/g, '');
    const save = window.tFinSavePlan; delete window.tFinSavePlan;
    let said = ''; window.toast = m => { said = m; };
    let threw = '';
    try { finNextSave(); } catch (e) { threw = String(e.message || e); }
    if (save) window.tFinSavePlan = save;
    finClose();
    return { live, said, threw };
  });
  ok('итог пересчитался прямо во время ввода: +2 000 000', NX.live === '+2000000', NX.live);
  ok('без соединения — фраза, а не падение',
    NX.threw === '' && /Нет соединения с базой/.test(NX.said), NX);

  console.log('[L] защита от двойного ввода живёт одну запись, а не всю сессию');
  const DUP = await page.evaluate(() => {
    window._finDupOk = true;                       // как будто уже предупреждали раньше
    finOpOpen('expense');
    const after = window._finDupOk;
    finClose();
    return after;
  });
  ok('открытие новой операции снимает разрешение на дубль', DUP === false, DUP);

  console.log('[M] окно финансов ведёт себя как модальное');
  const MD = await page.evaluate(() => {
    const el = document.getElementById('ov-fin');
    return { role: el.getAttribute('role'), modal: el.getAttribute('aria-modal') };
  });
  ok('у него роль диалога и признак модальности',
    MD.role === 'dialog' && MD.modal === 'true', MD);

  console.log('[N] Escape закрывает список, а не окно вместе с введённым');
  const ESC = await page.evaluate(async () => {
    window.FINX.accounts = [{ id: 'W', name: 'Карта', kind: 'card', opening_balance: 0, sort: 1 }];
    finOpOpen('expense');
    const dd = document.querySelector('#ov-fin .ddsel');
    const id = dd.id.replace(/^seldd-/, '');
    selToggle(id);
    const openBefore = !!document.querySelector('.dd.open') || !!document.querySelector('.dd-menu.dd-portal');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    const out = { openBefore,
      ddAfter: !!document.querySelector('.dd.open') || !!document.querySelector('.dd-menu.dd-portal'),
      winAfter: document.getElementById('ov-fin').classList.contains('on') };
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise(r => setTimeout(r, 60));
    out.winFinal = document.getElementById('ov-fin').classList.contains('on');
    finClose();
    return out;
  });
  ok('список открылся', ESC.openBefore === true, ESC);
  ok('первый Escape закрывает список и оставляет окно',
    ESC.ddAfter === false && ESC.winAfter === true, ESC);
  ok('второй Escape закрывает уже окно', ESC.winFinal === false, ESC);

  console.log('[O] карточка проекта не показывает месяц, выбранный в «Финансах»');
  const PF = await page.evaluate(() => {
    const z = v => String(v).padStart(2, '0'); const n = new Date();
    const cur = ['январь','февраль','март','апрель','май','июнь','июль',
      'август','сентябрь','октябрь','ноябрь','декабрь'][n.getMonth()];
    window._FINOFF = -1;                            // как будто пролистали назад в «Финансах»
    window.PFIN = { id: 'zeta', name: 'Зета', mrr: 12000000, salaries: [], opex: [], projex: [], hlog: [], hours: 0 };
    const html = pfFactHtml();
    window._FINOFF = 0;
    return { cur, has: html.indexOf(cur) >= 0, off: -1 };
  });
  ok('в окне проекта стоит текущий месяц, а не пролистанный', PF.has === true, PF);

  console.log('[P] на телефоне числа не наезжают друг на друга');
  await page.setViewportSize({ width: 390, height: 900 });
  const MOB = await page.evaluate(() => {
    const z = v => String(v).padStart(2, '0'); const n = new Date();
    const td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-01';
    const pm = new Date(); pm.setMonth(pm.getMonth() - 1);
    const pd = pm.getFullYear() + '-' + z(pm.getMonth() + 1) + '-05';
    window._FINOFF = 0;
    PROJECTS.length = 0;
    PROJECTS.push({ id: 'a', name: 'АЛЬФА', status: 'active', mrr: 500000000, cost: 300000000 });
    window.FINX = { ready: true, accounts: [{ id: 'W', name: 'Карта', kind: 'card', opening_balance: 0, sort: 1 }],
      ops: [ { id: '1', op_date: td, kind: 'income',  amount: 150000000, account_id: 'W', project_id: 'a', category: 'Оплата' },
             { id: '2', op_date: td, kind: 'expense', amount: 120000000, account_id: 'W', category: 'Зарплаты' },
             { id: '3', op_date: pd, kind: 'income',  amount: 135000000, account_id: 'W', category: 'Оплата' },
             { id: '4', op_date: pd, kind: 'expense', amount: 110000000, account_id: 'W', category: 'Зарплаты' } ] };
    window.FINP = []; window.FINO = []; window.FINS = {}; window.FINM = [];
    window.FINANCE = { ready: true, projects: PROJECTS, totalMrr: 500000000, totalCost: 300000000,
      profit: 200000000, marginPct: 40, costPct: 60, paying: 1, total: 1, avgMrr: 500000000,
      totalHours: 0, services: [], tariffs: [], snapshots: [] };
    renderFinance();
    const over = s => [...document.querySelectorAll(s)]
      .filter(e => e.scrollWidth > e.clientWidth + 1).length;
    return { cmp: over('.fcmp'), cat: over('.fcat'), fc: over('.fnx-fc'), three: over('.fst-3 .fst-c') };
  });
  ok('строки сравнения помещаются в экран', MOB.cmp === 0, MOB.cmp);
  ok('строки статей расхода тоже', MOB.cat === 0, MOB.cat);
  ok('и строки проектов', MOB.fc === 0, MOB.fc);
  ok('крупные числа шагов не вылезают из карточек', MOB.three === 0, MOB.three);

  console.log('[Q] один язык на всём экране');
  /* Модуль читается как последовательность, но на экране это были семь
     независимых плит, а часть блоков осталась в старом языке: крупный
     заголовок без разрядки, цветная полоса, скруглённая карточка внутри
     карточки. Рядом с новыми шагами это читалось как чужой продукт. */
  await page.setViewportSize({ width: 1500, height: 1000 });
  const D = await page.evaluate(() => {
    window._FINOFF = 0;
    window.__me = { id: 'u1', role: 'agency_owner' }; window.tMe = () => window.__me;
    const z = v => String(v).padStart(2, '0'); const n = new Date();
    const td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-01';
    PROJECTS.length = 0;
    PROJECTS.push({ id: 'a', name: 'АЛЬФА', status: 'active', mrr: 45000000, cost: 20000000 });
    window.FINX = { ready: true, accounts: [
      { id: 'W', name: 'Карта', kind: 'card', opening_balance: 5000000, sort: 1 },
      { id: 'R', name: 'Резерв', kind: 'bank', opening_balance: 8000000, purpose: 'reserve', is_reserve: true, sort: 2 }],
      ops: [ { id: '1', op_date: td, kind: 'income',  amount: 45000000, account_id: 'W', project_id: 'a', category: 'Оплата' },
             { id: '2', op_date: td, kind: 'expense', amount: 22000000, account_id: 'W', category: 'Зарплаты' } ] };
    window.FINP = [{ id: 'p', flow: 'out', title: 'Зарплаты', amount: 22000000, every: 'month',
      day_of_month: 5, category: 'Зарплаты' }];
    window.FINO = [{ id: 'o1', name: 'Нурислам', role_title: 'CEO', share_pct: 60, sort: 1 },
                   { id: 'o2', name: 'Партнёр', role_title: 'Совладелец', share_pct: 40, sort: 2 }];
    window.FINS = { owners_pct: 40, reserve_pct: 15, charity_pct: 5, reserve_target_months: 3 };
    window.FINM = [];
    window.FINANCE = { ready: true, projects: PROJECTS, totalMrr: 45000000, totalCost: 20000000,
      profit: 25000000, marginPct: 56, costPct: 44, paying: 1, total: 1, avgMrr: 45000000, totalHours: 120,
      services: [{ name: 'SMART', amount: 45000000, pct: 100, margin: 56, count: 1, color: '#37E6C8' }],
      tariffs: [], snapshots: [] };
    renderFinance();
    const root = document.getElementById('content-ag');
    root.querySelectorAll('details').forEach(d => d.open = true);
    const box = document.body.appendChild(root);
    box.style.cssText = 'position:fixed;left:0;top:0;width:1460px;background:#0a0d0c;z-index:99;padding:24px';
    const num = [...box.querySelectorAll('.fst-n')].map(e => Math.round(e.getBoundingClientRect().left));
    const panels = [...box.querySelectorAll('.fst>.fnx-pl, .fst>.fst-3')].map(e => Math.round(e.getBoundingClientRect().left));
    const heads = [...box.querySelectorAll('.fnx-pl-h')].map(e => Math.round(e.getBoundingClientRect().height));
    const mono = s2 => { const e = box.querySelector(s2); return e ? /Mono|mono/.test(getComputedStyle(e).fontFamily) : null; };
    const cs = s2 => { const e = box.querySelector(s2); return e ? getComputedStyle(e) : null; };
    const ow = cs('.fnx-ow');
    const spine = box.querySelector('.fst') ? getComputedStyle(box.querySelector('.fst'), '::before').width : '';
    return {
      numLeft: [...new Set(num)], panelLeft: [...new Set(panels)],
      headH: [...new Set(heads)],
      oldBrk: box.querySelectorAll('.brk, .brk-card, .brk-top').length,
      brkMono: mono('.fbr-v'), brkLbl: (cs('.fbr-r.hd') || {}).textTransform,
      owRadius: ow ? ow.borderRadius : null, owBg: ow ? ow.backgroundColor : null,
      owLbl: (cs('.fnx-ow-g span') || {}).textTransform,
      spine: spine,
      overflow: [...box.querySelectorAll('.fnx-pl, .fst-3, .fbr-r, .fnx-ow')]
        .filter(e => e.scrollWidth > e.clientWidth + 1).length };
  });
  ok('номера шагов стоят на одной вертикали', D.numLeft.length === 1, D.numLeft);
  ok('и все панели шагов начинаются с одной левой кромки', D.panelLeft.length === 1, D.panelLeft);
  ok('между номерами протянута линия — лента читается как последовательность',
    D.spine === '1px', D.spine);
  ok('шапки панелей одной высоты, а не каждая своей', D.headH.length === 1, D.headH);
  ok('старой карточки разбивки на экране нет', D.oldBrk === 0, D.oldBrk);
  ok('разбивка набрана теми же моноширинными числами и капительными подписями',
    D.brkMono === true && D.brkLbl === 'uppercase', [D.brkMono, D.brkLbl]);
  ok('совладелец — ячейка панели, а не карточка внутри карточки',
    D.owRadius === '0px' && /rgba\(0, 0, 0, 0\)|transparent/.test(D.owBg), [D.owRadius, D.owBg]);
  ok('и его подписи — тот же капительный моноширинный', D.owLbl === 'uppercase', D.owLbl);
  ok('ничего не вылезает за свои границы', D.overflow === 0, D.overflow);

  await page.setViewportSize({ width: 1280, height: 900 });

  console.log('[R] концентрация прихода считается после возвратов');
  const CC = await page.evaluate(() => {
    const z = v => String(v).padStart(2, '0'); const n = new Date();
    const td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-01';
    window._FINOFF = 0;
    PROJECTS.length = 0;
    PROJECTS.push({ id: 'a', name: 'APOLO COFFEE', status: 'active', mrr: 45000000, cost: 0 });
    PROJECTS.push({ id: 'b', name: 'Artel',        status: 'active', mrr: 20000000, cost: 0 });
    window.FINX = { ready: true, accounts: [{ id: 'W', name: 'Карта', kind: 'card', opening_balance: 0, sort: 1 }],
      ops: [ { id: '1', op_date: td, kind: 'income',     amount: 45000000, account_id: 'W', project_id: 'a' },
             { id: '2', op_date: td, kind: 'income',     amount: 20000000, account_id: 'W', project_id: 'b' },
             { id: '3', op_date: td, kind: 'refund_out', amount: 5000000,  account_id: 'W', project_id: 'b' } ] };
    window.FINP = []; window.FINO = []; window.FINS = {}; window.FINM = [];
    window.FINANCE = { ready: true, projects: PROJECTS, rows: PROJECTS, totalMrr: 65000000, totalCost: 0,
      profit: 65000000, marginPct: 100, costPct: 0, paying: 2, total: 2, avgMrr: 32500000,
      totalHours: 0, profitPerHour: 0, services: [], tariffs: [], snapshots: [], prevSnap: null, cats: [] };
    renderFinance();
    const root = document.getElementById('content-ag');
    const tile = [...root.querySelectorAll('.fst-c')]
      .find(e => /Концентрация/.test((e.querySelector('.l') || {}).textContent || ''));
    return { month: finMonthNow().income,
      label: tile ? tile.querySelector('.l').textContent.trim() : null,
      value: tile ? tile.querySelector('.v').textContent.trim() : null };
  });
  ok('приход месяца — 60 000 000: возврат вычтен', CC.month === 60000000, CC.month);
  ok('доля крупнейшего — 75% от прихода, а не 69% от оборота',
    CC.value === '75%', CC);
  ok('и названа по своей базе — концентрация прихода',
    CC.label === 'Концентрация прихода', CC.label);

  console.log('[S] «авансами пришло» — про месяц, а не про остаток на счетах');
  const AV = await page.evaluate(() => {
    const z = v => String(v).padStart(2, '0'); const n = new Date();
    const td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-01';
    window._FINOFF = 0; PROJECTS.length = 0;
    window.FINX = { ready: true, accounts: [{ id: 'W', name: 'Карта', kind: 'card', opening_balance: 0, sort: 1 }],
      ops: [ { id: '1', op_date: td, kind: 'prepay',  amount: 20000000, account_id: 'W', category: 'Аванс' },
             { id: '2', op_date: td, kind: 'expense', amount: 18000000, account_id: 'W', category: 'Зарплаты' } ] };
    window.FINP = []; window.FINO = []; window.FINS = {}; window.FINM = [];
    renderFinance();
    const root = document.getElementById('content-ag');
    const note = root.querySelector('.fnx-h-note');
    return { total: finM().total, prepaid: finM().prepaid,
      note: note ? note.textContent.replace(/\s+/g, ' ').trim() : null };
  });
  ok('на счетах 2 000 000, а авансами за месяц пришло 20 000 000',
    AV.total === 2000000 && AV.prepaid === 20000000, AV);
  ok('подпись говорит «за месяц пришло», а не «из них»',
    !!AV.note && /авансами пришло/.test(AV.note) && !/из них/.test(AV.note), AV.note);

  console.log('[T] настройки шлют своё поле, а не переписывают чужое из кэша');
  const ST = await page.evaluate(async () => {
    const sent = [];
    window.tFinSaveSettings = row => { sent.push(row); return new Promise(() => {}); };
    window.FINS = { owners_pct: 40, reserve_pct: 20, charity_pct: 5, reserve_target_months: 3 };
    finResCfg(); finResCfgSave();
    finClose();
    finDistCfg(); finDistCfgSave();
    finClose();
    return { res: Object.keys(sent[0] || {}).sort(), dist: Object.keys(sent[1] || {}).sort() };
  });
  ok('цель резерва шлёт только себя — доли из устаревшего кэша не едут следом',
    JSON.stringify(ST.res) === JSON.stringify(['reserve_target_months']), ST.res);
  ok('и доли шлют только доли, не трогая цель резерва',
    JSON.stringify(ST.dist) === JSON.stringify(['charity_pct', 'owners_pct', 'reserve_pct']), ST.dist);

  console.log('[U] закрытие месяца отменяется, а не удаляется');
  const MCL = await page.evaluate(() => {
    const api = Object.keys(window).filter(k => /^tFin/.test(k) && typeof window[k] === 'function');
    const dels = api.filter(k => /\.delete\s*\(/.test(String(window[k])));
    return { hasUndo: typeof window.tFinUndoMonth === 'function',
      undoUpdates: /undone_at/.test(String(window.tFinUndoMonth || '')),
      undoVoidsOps: /month_close_id/.test(String(window.tFinUndoMonth || '')),
      deleters: dels };
  });
  ok('отмена закрытия помечает undone_at, а не удаляет строку',
    MCL.hasUndo && MCL.undoUpdates === true, MCL);
  ok('и отменяет проводки распределения по month_close_id, а не бросает их',
    MCL.undoVoidsOps === true, MCL);
  ok('ни одна операция с базой не удаляет записей — только отмена',
    MCL.deleters.length === 0, MCL.deleters);

  console.log('[V] длинное имя счёта остаётся внутри карточки');
  const LN = await page.evaluate(() => {
    window._FINOFF = 0; PROJECTS.length = 0;
    window.FINX = { ready: true, accounts: [
      { id: 'W', name: 'Расчётный счёт в банке для расчётов с подрядчиками и налогов',
        kind: 'bank', opening_balance: 0, sort: 1 },
      { id: 'C', name: 'Карта', kind: 'card', opening_balance: 0, sort: 2 }], ops: [] };
    window.FINP = []; window.FINO = []; window.FINS = {}; window.FINM = [];
    renderFinance();
    const cards = [...document.querySelectorAll('#content-ag .fnx-acc')];
    return { n: cards.length,
      over: cards.filter(e => e.scrollWidth > e.clientWidth + 1).length,
      heights: [...new Set(cards.map(e => Math.round(e.getBoundingClientRect().height)))].length };
  });
  ok('карточки счетов нарисованы', LN.n === 2, LN.n);
  ok('длинное имя не вылезает за карточку', LN.over === 0, LN.over);
  ok('и не растягивает её выше соседней', LN.heights === 1, LN.heights);

  console.log('[W] стрелки месяцев на пределе не притворяются рабочими');
  const NV = await page.evaluate(() => {
    const read = off => { window._FINOFF = off; renderFinance();
      const nav = document.querySelector('#content-ag .fst-mon');
      const b = nav ? nav.querySelectorAll('button') : [];
      return b.length === 2 ? { back: b[0].disabled, fwd: b[1].disabled } : null; };
    return { now: read(0), mid: read(-1), edge: read(-120) };
  });
  ok('в текущем месяце вперёд некуда — стрелка отключена, а не молчит',
    NV.now && NV.now.fwd === true && NV.now.back === false, NV.now);
  ok('в прошлом месяце работают обе', NV.mid && NV.mid.back === false && NV.mid.fwd === false, NV.mid);
  ok('на пределе истории назад больше нельзя — и это видно',
    NV.edge && NV.edge.back === true && NV.edge.fwd === false, NV.edge);

  console.log('[X] пояснение под числами — низ той же панели, а не плашка под ней');
  /* Числа держали скругление со всех четырёх сторон и собственную тень, а
     пояснение начиналось своим прямым верхом. Две кромки вставали друг
     напротив друга, между ними падала тень — и текст, который объясняет
     стоящие над ним числа, читался как чужой блок. */
  const NT = await page.evaluate(() => {
    /* Своя сцена: пояснения появляются только там, где есть что пояснять,
       и правило про одну панель должно держаться на всех сразу. */
    const z = v => String(v).padStart(2, '0'); const n = new Date();
    const td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-01';
    window._FINOFF = 0;
    PROJECTS.length = 0;
    PROJECTS.push({ id: 'a', name: 'АЛЬФА', status: 'active', mrr: 45000000, cost: 20000000 });
    window.FINX = { ready: true, accounts: [
      { id: 'W', name: 'Карта', kind: 'card', opening_balance: 5000000, sort: 1 }],
      ops: [ { id: '1', op_date: td, kind: 'income',  amount: 45000000, account_id: 'W', project_id: 'a', category: 'Оплата' },
             { id: '2', op_date: td, kind: 'expense', amount: 22000000, account_id: 'W', category: 'Зарплаты' } ] };
    window.FINP = [{ id: 'p', flow: 'out', title: 'Зарплаты', amount: 22000000, every: 'month',
      day_of_month: 5, category: 'Зарплаты' }];
    window.FINO = []; window.FINM = [];
    window.FINS = { owners_pct: 40, reserve_pct: 15, charity_pct: 5, reserve_target_months: 3 };
    window.FINANCE = { ready: true, projects: PROJECTS, rows: PROJECTS, totalMrr: 45000000,
      totalCost: 20000000, profit: 25000000, marginPct: 56, costPct: 44, paying: 1, total: 1,
      avgMrr: 45000000, totalHours: 0, profitPerHour: 0, services: [], tariffs: [], snapshots: [],
      prevSnap: null, cats: [] };
    renderFinance();
    const cs = e => e ? getComputedStyle(e) : null;
    const pairs = [...document.querySelectorAll('#content-ag .fst-note')]
      .map(note => ({ note, grid: note.previousElementSibling }))
      .filter(p => p.grid && p.grid.classList.contains('fst-3'));
    if (!pairs.length) return { n: 0 };
    const drop = s => /rgba?\([^)]*\)\s+0px\s+26px\s+60px|0px 26px 60px/.test(s || '');
    const bad = { нижнее_скругление_у_чисел: 0, тень_у_чисел: 0,
      нет_скругления_у_пояснения: 0, нет_тени_у_пояснения: 0, шов: 0 };
    pairs.forEach(({ note, grid }) => {
      const g = cs(grid), t = cs(note);
      if (g.borderBottomLeftRadius !== '0px' || g.borderBottomRightRadius !== '0px')
        bad.нижнее_скругление_у_чисел++;
      if (drop(g.boxShadow)) bad.тень_у_чисел++;
      if (t.borderBottomLeftRadius === '0px' || t.borderBottomRightRadius === '0px')
        bad.нет_скругления_у_пояснения++;
      if (!drop(t.boxShadow)) bad.нет_тени_у_пояснения++;
      if (t.borderTopStyle !== 'none' || t.marginTop !== '-1px') bad.шов++;
    });
    return { n: pairs.length, bad, пример: cs(pairs[0].grid).borderRadius + ' / ' + cs(pairs[0].note).borderRadius };
  });
  ok('на экране есть числа с пояснением под ними', NT.n >= 2, NT.n);
  ok('числа не закругляются снизу — панель на них не заканчивается',
    NT.bad && NT.bad.нижнее_скругление_у_чисел === 0, NT);
  ok('и не отбрасывают свою тень на пояснение', NT.bad && NT.bad.тень_у_чисел === 0, NT);
  ok('скругление и тень достались пояснению: панель одна',
    NT.bad && NT.bad.нет_скругления_у_пояснения === 0 && NT.bad.нет_тени_у_пояснения === 0, NT);
  ok('между числами и пояснением нет шва — одна общая линия',
    NT.bad && NT.bad.шов === 0, NT);

  /* Обратная беда той же правки: пояснение стало низом панели, но своего
     нижнего отступа у него не было. Под ним, в шаге «Следующий месяц»,
     сразу шли «Ближайшие платежи» — и две скруглённые кромки вставали
     вплотную, панели слипались. Шаг между панелями в модуле один и тот
     же, 12; проверка меряет его у всех соседей сразу, а не у этой пары. */
  const GAP = await page.evaluate(() => {
    /* вкладка агентства обычно скрыта — без этого у всего нулевые размеры,
       и проверка на зазоры прошла бы, ничего не измерив */
    const el = document.getElementById('content-ag');
    let up = el;
    while (up && up !== document.body) {
      up.style.setProperty('display', 'block', 'important');
      up.style.setProperty('visibility', 'visible', 'important');
      up = up.parentElement;
    }
    document.querySelectorAll('[id^="content-"]').forEach(e => {
      if (e !== el) e.style.setProperty('display', 'none', 'important');
    });
    const слиплись = [], измерено = [];
    document.querySelectorAll('#content-ag section.fst').forEach(sec => {
      const t = ((sec.querySelector('.fst-t') || {}).textContent || '?').trim();
      const kids = [...sec.children].filter(e => !/fst-h/.test(String(e.className)));
      for (let i = 0; i + 1 < kids.length; i++) {
        const a = kids[i], b2 = kids[i + 1];
        const g = Math.round(b2.getBoundingClientRect().top - a.getBoundingClientRect().bottom);
        /* −1 — намеренный стык чисел и пояснения: это одна панель */
        const шов = a.classList.contains('fst-3') && b2.classList.contains('fst-note');
        if (шов) continue;
        измерено.push(t + ': ' + g);
        if (g < 10) слиплись.push(t + ' · ' + String(a.className).slice(0, 20)
          + ' → ' + String(b2.className).slice(0, 20) + ' · зазор ' + g);
      }
    });
    return { слиплись, измерено, всего: измерено.length };
  });
  ok('зазоры между панелями шагов вообще измерены, а не приняты на веру', GAP.всего >= 3, GAP);
  ok('ни одна панель внутри шага не прилипла к соседней', GAP.слиплись.length === 0, GAP.слиплись);

  console.log(errs.length ? 'ОШИБКИ: ' + JSON.stringify(errs.slice(0, 3)) : '');
  ok('страница не бросила ни одной ошибки', errs.length === 0, errs.slice(0, 3));
  await b.close();
  console.log(`\n${pass} ok · ${fail} fail`);
  process.exit(fail ? 1 : 0);
})();
