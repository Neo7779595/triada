/* probe_pop — всплывашки даты и времени не режутся боковой колонкой формы */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    window.__me = { id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' };
    window.tMe = () => window.__me; window.ME = window.__me; window.toast = () => {};
    window.LIVE = false; window.agIsOwner = () => true; window.agCanEditProject = () => true; window.agCanDocs = () => true;
    window.giEnsureStatus = async () => ({ status: 'inactive' }); window.ctBadge = () => '';
    window.tLoadProjectWork = null; window.tLoadProjectToday = null;
    TEAM = [{ _id: 'm1', name: 'Худойберди', color: '#37E6C8', avatar: null }];
    PROJECTS = [{ id: 'p1', name: 'Artel', logo: 'A', logoUrl: null, cat: 'IT', svc: 'SMM', pct: 0, stages: '1 / 2',
      status: 'active', mrr: 0, cost: 0, tg_chat_id: null, client_id: null, contacts: null, ui: null, kb: null,
      leads: ['m1'], lead_id: 'm1', _appr: [], _stages: [{ id: 's1', name: 'ПРОДАКШН', status: 'active' }], _tasks: [], _reports: [] }];
    openProject(0); pdTab('kanban'); await pdNewTask('wait');
  });
  await page.waitForTimeout(500);

  console.log('\n[A] время');
  const tp = await page.evaluate(() => {
    tpOpen('pd2-ttime');
    const pop = document.querySelector('.tp-pop'); if (!pop) return null;
    const r = pop.getBoundingClientRect();
    const modal = document.querySelector('#ov-pd2 .modal.tskm').getBoundingClientRect();
    const side = document.querySelector('.tskm-side').getBoundingClientRect();
    return { pos: getComputedStyle(pop).position, r: { l: Math.round(r.left), t: Math.round(r.top), rr: Math.round(r.right), bb: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) },
      inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      sideRight: Math.round(side.right), modalRight: Math.round(modal.right),
      presets: pop.querySelectorAll('.tp-preset').length, foot: pop.querySelectorAll('.tp-foot button').length };
  });
  console.log('    ' + JSON.stringify(tp));
  ok('окно времени открылось', !!tp && tp.presets === 6 && tp.foot === 2, tp);
  ok('оно вынесено из обрезающей колонки', tp.pos === 'fixed', tp.pos);
  ok('и целиком помещается на экране', tp.inView, tp);
  ok('видно всю ширину, ничего не срезано', tp.r.w >= 200, tp.r);
  const pick = await page.evaluate(() => { tpPreset('pd2-ttime', '15:00');
    return { v: document.getElementById('pd2-ttime').value, closed: !document.querySelector('.tp-pop'),
      shown: document.querySelector('#tpw-pd2-ttime .dp-val').textContent }; });
  console.log('    ' + JSON.stringify(pick));
  ok('выбор времени срабатывает и окно закрывается', pick.v === '15:00' && pick.closed && pick.shown === '15:00', pick);

  console.log('\n[B] дата');
  const dp = await page.evaluate(() => {
    dpOpen('pd2-tdate');
    const pop = document.querySelector('.dp-pop'); if (!pop) return null;
    const r = pop.getBoundingClientRect();
    return { pos: getComputedStyle(pop).position, inView: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      days: pop.querySelectorAll('.dp-grid button:not(.oth)').length, w: Math.round(r.width) };
  });
  console.log('    ' + JSON.stringify(dp));
  ok('календарь открылся целиком', !!dp && dp.days >= 28 && dp.inView, dp);
  ok('и тоже не режется', dp.pos === 'fixed', dp.pos);
  await page.evaluate(() => _closePops());

  console.log('\n[C] обычная форма — всплывашка по-прежнему прижата к полю');
  const plain = await page.evaluate(() => {
    pd2Close();
    pd2Open('<div class="modal"><div class="modal-b"><div class="fld"><label>Срок</label><div class="dl-dt">' + dateField('x-d', '') + timeField('x-t', '') + '</div></div></div></div>');
    tpOpen('x-t');
    const pop = document.querySelector('.tp-pop');
    const wrap = document.getElementById('tpw-x-t').getBoundingClientRect();
    const r = pop.getBoundingClientRect();
    return { pos: getComputedStyle(pop).position, near: Math.abs(r.left - wrap.left) < 40 };
  });
  console.log('    ' + JSON.stringify(plain));
  ok('в обычной модалке всплывашка стоит у своего поля', plain.near, plain);
  await page.evaluate(() => { _closePops(); pd2Close(); });

  console.log('\n[D] поле названия');
  await page.evaluate(async () => { await pdNewTask('wait'); });
  await page.waitForTimeout(400);
  const ttl = await page.evaluate(() => {
    const i = document.getElementById('pd2-ttl'); i.focus();
    const cs = getComputedStyle(i);
    return { caret: cs.caretColor, shadow: cs.boxShadow, border: cs.borderColor, focused: document.activeElement === i };
  });
  console.log('    ' + JSON.stringify(ttl));
  ok('курсор виден — акцентного цвета', /55,\s*230|rgb/.test(ttl.caret) && ttl.caret !== ttl.border, ttl);
  ok('свечения вокруг поля нет', /none/.test(ttl.shadow), ttl);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
  console.log('\n[E] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));
  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
