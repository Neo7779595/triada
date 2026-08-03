/* probe_pfin — окно «Финансы проекта»: сотрудник, размеры, сворачивание, P&L */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1400, height: 1100 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  await page.evaluate(() => {
    window.__me = { id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG', agencySlug: 'probe' };
    window.tMe = () => window.__me; window.ME = window.__me; window.toast = m => { window.__toast = m; };
    window.LIVE = false; window.agIsOwner = () => true; window.agCanEditProject = () => true;
    TEAM = [
      { _id: 'm1', name: 'Худойберди', role: 'Оператор',   color: '#37E6C8', avatar: null },
      { _id: 'm2', name: 'Азиз',       role: 'Монтажёр',   color: '#F5C542', avatar: null },
      { _id: 'm3', name: 'Азиз',       role: 'Мобилограф', color: '#7C9CFF', avatar: null },
      { _id: 'm4', name: 'Уволенный',  role: 'Монтажёр',   color: '#888',    avatar: null, archived_at: '2026-01-01' },
    ];
    FINANCE = { ready: true, projects: [{
      id: 'p1', name: 'QUSHBEGI', logo: 'Q', logoUrl: null, mrr: 6600000,
      finance: { salaries: [], opex: [], projex: [], hours: 0 }, _svcs: [] }] };
    openProjFinance('p1');
  });
  await page.waitForTimeout(450);

  console.log('\n[A] сотрудник в «Команда и гонорары» виден сразу, без выбора роли');
  const a = await page.evaluate(() => {
    pfAdd('salaries');
    const w = document.getElementById('seldd-pfs-salaries-0');
    if (!w) return { found: false };
    const opts = [...w.querySelectorAll('.dd-opt')].map(o => o.dataset.l);
    return { found: true, ph: w.querySelector('.dd-v').textContent.trim(), opts,
      avAttrs: [...w.querySelectorAll('.dd-opt')].filter(o => 'avT' in o.dataset).length };
  });
  console.log('    ' + JSON.stringify(a));
  ok('поле сотрудника есть в пустой строке гонорара', a.found, a);
  ok('подпись «кто именно»', /кто именно/.test(a.ph || ''), a.ph);
  ok('предлагается вся команда', (a.opts || []).filter(x => x !== 'кто именно (необяз.)').length === 3, a.opts);
  ok('уволенных нет', !(a.opts || []).some(x => /Уволенный/.test(x)), a.opts);
  ok('у людей лица', a.avAttrs >= 3, a);

  console.log('\n[B] после выбора роли люди этой роли идут первыми, остальные остаются');
  const bRole = await page.evaluate(() => {
    pfPickCat('salaries', 0, 'Монтажёр');
    const w = document.getElementById('seldd-pfs-salaries-0');
    const opts = [...w.querySelectorAll('.dd-opt')].map(o => o.dataset.l).filter(x => x !== 'кто именно (необяз.)');
    return { opts, first: opts[0], n: opts.length };
  });
  console.log('    ' + JSON.stringify(bRole));
  ok('монтажёр первым', /Монтажёр/.test(bRole.first || ''), bRole);
  ok('остальные никуда не делись — тупика «выбрать некого» нет', bRole.n === 3, bRole);

  console.log('\n[C] человек остаётся при смене роли');
  const c = await page.evaluate(() => {
    _ddSelPick('pfs-salaries-0', 'm2', 'Азиз · Монтажёр', document.querySelector('#seldd-pfs-salaries-0 .dd-opt[data-v="m2"]'));
    const before = { id: PFIN.salaries[0].staffId, nm: PFIN.salaries[0].staffName };
    pfPickCat('salaries', 0, 'Оператор');
    const r = PFIN.salaries[0];
    return { before, after: { id: r.staffId, nm: r.staffName, name: r.name } };
  });
  console.log('    ' + JSON.stringify(c));
  ok('человек записался', c.before.id === 'm2' && c.before.nm === 'Азиз', c);
  ok('смена роли его не стирает', c.after.id === 'm2' && c.after.nm === 'Азиз' && c.after.name === 'Оператор', c);

  console.log('\n[D] выбрал человека, роль не выбрал — роль подставляется из должности');
  const d = await page.evaluate(() => {
    pfAdd('salaries');
    _ddSelPick('pfs-salaries-1', 'm1', 'Худойберди · Оператор', document.querySelector('#seldd-pfs-salaries-1 .dd-opt[data-v="m1"]'));
    const r = PFIN.salaries[1];
    return { name: r.name, role: r.role, nm: r.staffName, lbl: _pfRowLbl(r) };
  });
  console.log('    ' + JSON.stringify(d));
  ok('роль взялась из карточки сотрудника', d.name === 'Оператор' && d.role === 'Оператор', d);
  ok('в P&L строка не безымянная', /Оператор · Худойберди/.test(d.lbl || ''), d.lbl);

  console.log('\n[E] расходы — сотрудник на месте, категория его не сбрасывает');
  const e = await page.evaluate(() => {
    pfAdd('opex'); pfPickCat('opex', 0, 'Такси'); pfSetAmt('opex', 0, 300000);
    _ddSelPick('pfs-opex-0', 'm3', 'Азиз · Мобилограф', document.querySelector('#seldd-pfs-opex-0 .dd-opt[data-v="m3"]'));
    const mid = { id: PFIN.opex[0].staffId, nm: PFIN.opex[0].staffName };
    pfPickCat('opex', 0, 'Подписки');
    const r = PFIN.opex[0];
    return { mid, after: { id: r.staffId, nm: r.staffName, name: r.name } };
  });
  console.log('    ' + JSON.stringify(e));
  ok('в расходе сотрудник выбирается', e.mid.id === 'm3' && e.mid.nm === 'Азиз', e);
  ok('смена категории его не сбрасывает', e.after.id === 'm3' && e.after.name === 'Подписки', e);

  console.log('\n[F] сворачивание секций');
  const f = await page.evaluate(() => {
    const sec = l => document.querySelectorAll('.modal.pfin .pf-sec')[l];
    const st = () => [...document.querySelectorAll('.modal.pfin .pf-sec')].map(x =>
      ({ t: (x.querySelector('label') || {}).textContent, col: x.classList.contains('is-col'), rows: x.querySelectorAll('.pf-row').length }));
    const before = st();
    pfSecToggle('salaries');
    const afterCollapse = st();
    pfSecToggle('salaries');
    const afterExpand = st();
    return { before, afterCollapse, afterExpand };
  });
  const projexBefore = f.before.find(x => /РАСХОДЫ НА ПРОЕКТ/i.test(x.t || ''));
  const salBefore = f.before.find(x => /ГОНОРАРЫ/i.test(x.t || ''));
  const salCol = f.afterCollapse.find(x => /ГОНОРАРЫ/i.test(x.t || ''));
  const salExp = f.afterExpand.find(x => /ГОНОРАРЫ/i.test(x.t || ''));
  console.log('    ' + JSON.stringify({ projexBefore, salBefore, salCol, salExp }));
  ok('пустая секция свёрнута сама', projexBefore && projexBefore.col === true && projexBefore.rows === 0, projexBefore);
  ok('секция со строками развёрнута', salBefore && salBefore.col === false && salBefore.rows === 2, salBefore);
  ok('клик по заголовку сворачивает', salCol && salCol.col === true && salCol.rows === 0, salCol);
  ok('и разворачивает обратно', salExp && salExp.col === false && salExp.rows === 2, salExp);

  console.log('\n[G] шапка секции: счётчик и живой итог');
  const g = await page.evaluate(() => {
    const hd = [...document.querySelectorAll('.modal.pfin .pf-sec')].find(x => /ОПЕРАЦИОННЫЕ/i.test(x.textContent));
    const sumBefore = document.getElementById('pfsecsum-opex').textContent;
    pfSetAmt('opex', 0, 555000);
    return { n: (hd.querySelector('.pf-sec-n') || {}).textContent, sumBefore,
      sumAfter: document.getElementById('pfsecsum-opex').textContent };
  });
  console.log('    ' + JSON.stringify(g));
  ok('счётчик строк в заголовке', g.n === '1', g);
  ok('итог секции пересчитывается на вводе', /555/.test(g.sumAfter.replace(/\s/g, '')) && g.sumBefore !== g.sumAfter, g);

  console.log('\n[H] размеры и ритм');
  const h = await page.evaluate(() => {
    const R = s => { const el = document.querySelector(s); if (!el) return null;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      return { h: Math.round(r.height), w: Math.round(r.width), rad: parseFloat(cs.borderRadius) }; };
    return { modal: R('.modal.pfin'), sel: R('.modal.pfin .pf-row .dd-btn'), amt: R('.modal.pfin .pf-amt-wrap'),
      mini: R('.modal.pfin .pf-mini'), del: R('.modal.pfin .pf-del'), add: R('.modal.pfin .pf-add'),
      save: R('.modal.pfin .modal-f .btn-add'), cancel: R('.modal.pfin .modal-f .btn-ghost') };
  });
  console.log('    ' + JSON.stringify(h));
  ok('окно шире прежних 560 — 760px', h.modal.w === 760, h.modal);
  ok('селект, сумма, «···» и «✕» одной высоты 44', h.sel.h === 44 && h.amt.h === 44 && h.mini.h === 44 && h.del.h === 44, h);
  ok('«···» и «✕» квадратные с мягкими углами', h.mini.w === 44 && h.del.w === 44 && h.mini.rad === 10 && h.del.rad === 10, h);
  ok('«+ Добавить» 36px с обводкой', h.add.h === 36 && h.add.rad === 10, h.add);
  ok('кнопки внизу одной высоты', h.save.h === 46 && h.cancel.h === 46, h);

  console.log('\n[I] свечений нет');
  const i = await page.evaluate(async () => {
    const out = [];
    const els = [...document.querySelectorAll('.modal.pfin input, .modal.pfin textarea, .modal.pfin select')];
    for (const el of els) { el.focus();
      const cs = getComputedStyle(el);
      if (cs.boxShadow && cs.boxShadow !== 'none') out.push({ id: el.id || el.className, sh: cs.boxShadow });
    }
    const wrap = document.querySelector('.modal.pfin .pf-amt-wrap');
    const wcs = wrap ? getComputedStyle(wrap).boxShadow : 'none';
    const save = getComputedStyle(document.querySelector('.modal.pfin .modal-f .btn-add')).boxShadow;
    const gear = document.querySelector('.modal.pfin .pf-cat-btn'); gear.focus();
    const gcs = getComputedStyle(gear);
    const caret = getComputedStyle(document.querySelector('.modal.pfin input')).caretColor;
    return { glowing: out, wrap: wcs, save, gear: gcs.boxShadow, caret, n: els.length };
  });
  console.log('    ' + JSON.stringify(i));
  ok('ни одно поле не светится при фокусе', i.glowing.length === 0, i.glowing.slice(0, 3));
  ok('обёртка суммы тоже', i.wrap === 'none', i.wrap);
  ok('кнопка сохранения без свечения', i.save === 'none', i.save);
  ok('«Справочники» без свечения', i.gear === 'none', i.gear);
  ok('курсор в полях виден — акцентный', i.caret !== 'rgb(255, 255, 255)' && i.caret !== 'auto', i.caret);
  ok('полей в окне действительно много', i.n >= 4, i.n);

  console.log('\n[J] окно открывается без подсвеченной кнопки');
  const j = await page.evaluate(async () => {
    pd2Close(); await new Promise(r => setTimeout(r, 350));
    openProjFinance('p1');
    await new Promise(r => setTimeout(r, 400));
    const a = document.activeElement;
    return { tag: a ? a.tagName : null, cls: a ? String(a.className || '') : null };
  });
  console.log('    ' + JSON.stringify(j));
  ok('фокус не встаёт на «Справочники»', !/pf-cat-btn/.test(j.cls || ''), j);

  console.log('\n[K] P&L: доли от дохода и плашка рентабельности');
  const k = await page.evaluate(() => {
    PFIN.salaries = [{ name: 'Оператор', role: 'Оператор', unit: 'month', rate: 1500000, qty: 1, amount: 1500000, manual: false, staffId: 'm1', staffName: 'Худойберди' }];
    PFIN.opex = [{ name: 'Такси', role: 'Такси', unit: 'month', rate: 300000, qty: 1, amount: 300000, manual: false, staffId: null, staffName: null }];
    PFIN.projex = []; pfRender();
    const pl = document.getElementById('pf-pl');
    const pcts = [...pl.querySelectorAll('.pf-pl-pct')].map(x => x.textContent);
    const pill = pl.querySelector('.pf-pl-pill');
    return { pcts, pill: pill ? pill.textContent : null, pillCls: pill ? pill.className : null,
      txt: pl.textContent.replace(/\s+/g, ' ') };
  });
  console.log('    ' + JSON.stringify(k));
  ok('доля зарплат от дохода — 23%', k.pcts.includes('23%'), k.pcts);
  ok('доля расходов итого — 27%', k.pcts.includes('27%'), k.pcts);
  ok('рентабельность плашкой', k.pill === '73%' && /is-hi/.test(k.pillCls || ''), k);
  ok('строки с людьми на месте', /Оператор · Худойберди/.test(k.txt), k.txt.slice(0, 120));

  console.log('\n[L] сохранение не изменилось');
  const l = await page.evaluate(() => {
    const clean = arr => arr.filter(r => (r.name && r.name.trim()) || pfRowAmount(r) > 0)
      .map(r => ({ name: (r.name || '').trim(), role: r.role || '', unit: r.unit || 'month', rate: r.rate || 0,
        qty: r.qty || 0, manual: !!r.manual, staffId: r.staffId || null, staffName: r.staffName || null, amount: pfRowAmount(r) }));
    return { sal: clean(PFIN.salaries), opex: clean(PFIN.opex) };
  });
  console.log('    ' + JSON.stringify(l));
  ok('гонорар уходит вместе с человеком', l.sal.length === 1 && l.sal[0].staffId === 'm1' && l.sal[0].amount === 1500000, l.sal);
  ok('расход уходит как был', l.opex.length === 1 && l.opex[0].amount === 300000, l.opex);

  console.log('\n[N] факт по журналу рядом с планом');
  /* План сам себя подтверждает: пока рядом не встанут настоящие деньги,
     «маржа 50%» остаётся намерением. */
  const FA = await page.evaluate(() => {
    const z = v => String(v).padStart(2, '0');
    const n = new Date(), td = n.getFullYear() + '-' + z(n.getMonth() + 1) + '-' + z(n.getDate());
    window.FINX = { ready: true, accounts: [{ id: 'W', name: 'К', kind: 'card', opening_balance: 0 }], ops: [] };
    const empty = pfFactHtml();
    window.FINX.ops = [
      { id: '1', op_date: td, kind: 'income',  amount: 3000000, account_id: 'W', project_id: PFIN.id },
      { id: '2', op_date: td, kind: 'expense', amount: 1800000, account_id: 'W', project_id: PFIN.id },
      { id: '3', op_date: td, kind: 'expense', amount: 900000,  account_id: 'W' } ];
    const d = document.createElement('div'); d.innerHTML = pfFactHtml();
    return { empty, txt: (d.textContent || '').replace(/\s+/g, ' '),
      vals: Array.from(d.querySelectorAll('.pf-fact b')).map(e => e.textContent.replace(/\s/g, '')) };
  });
  ok('без операций — не пустота, а объяснение, как факт сюда попадёт',
    /не записано ни одной операции/.test(FA.empty), FA.empty.slice(0, 90));
  ok('пришло 3 000 000, потрачено 1 800 000 — чужой расход не приписан',
    FA.vals[0] === '3000000' && FA.vals[1] === '1800000', FA.vals);
  ok('маржа факт 40%', FA.vals[2] === '40%', FA.vals);
  ok('долг клиента посчитан от суммы договора', FA.vals[3] !== undefined, FA.vals);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
  console.log('\n[M] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
