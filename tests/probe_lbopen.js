/* probe_lbopen — строка SMM-рейтинга открывает свой отчёт */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'detroyd', role: 'agency_owner', agency_id: 'AG' };
  window.tMe = () => window.__me;
  window.__toast = ''; window.toast = t => { window.__toast = String(t); };
  PROJECTS = [
    { id: 'p1', name: 'APOLO COFFEE', status: 'active', color: '#E3B567', logoUrl: null, pct: 40 },
    { id: 'p2', name: 'Artel', status: 'active', color: '#37E6C8', logoUrl: null, pct: 30 },
  ];
  const rep = (id, pid, when, period, m) => ({ id, project_id: pid, kind: 'SMM', title: 'SMM-отчёт',
    published_at: when, payload: { period, metrics: m } });
  /* полный набор: рилсы + сторис + ПОСТЫ. Итоги сходятся —
     600000+295253+2536 = 897789 охвата, 1200000+533991+8745 = 1742736 просмотров */
  const FULL = { er: 13.21, total_reach: 897789, total_views: 1742736, followers: 358,
    reels_count: 10, reels_views: 1200000, reels_reach: 600000,
    stories_count: 60, stories_views: 533991, stories_reach: 295253,
    posts_count: 1, posts_views: 8745, posts_reach: 2536,
    subscribers_current: 593000, frequency: 1.94 };
  window.__REPORTS = [
    rep('r-p1-jul', 'p1', '2026-07-01', 'Июль 2026', FULL),
    rep('r-p1-jun', 'p1', '2026-06-01', 'Июнь 2026', { er: 11.0, total_reach: 700000, total_views: 1200000, followers: 120 }),
    rep('r-p2-jul', 'p2', '2026-07-01', 'Июль 2026', { er: 8.76, total_reach: 1134533, total_views: 1953985, followers: 14583 }),
  ];
  window.__sbHits = [];
  window.SB = { from(table) {
    const q = { _f: {}, _t: table,
      select() { return q; },
      eq(k, v) { q._f[k] = v; return q; },
      in(k, v) { q._f[k + '__in'] = v; return q; },
      order() { window.__sbHits.push(JSON.stringify(q._f)); return Promise.resolve({ data: q._rows(), error: null }); },
      single() { const rs = q._rows(); window.__sbHits.push('single ' + JSON.stringify(q._f));
        return Promise.resolve({ data: rs[0] || null, error: rs.length ? null : { message: 'no rows' } }); },
      then(res, rej) { return Promise.resolve({ data: q._rows(), error: null }).then(res, rej); },
      _rows() {
        let rs = (window.__REPORTS || []).slice();
        if (q._f.id != null) rs = rs.filter(r => String(r.id) === String(q._f.id));
        if (q._f.project_id != null) rs = rs.filter(r => String(r.project_id) === String(q._f.project_id));
        if (q._f.kind != null) rs = rs.filter(r => r.kind === q._f.kind);
        if (q._f.project_id__in) rs = rs.filter(r => q._f.project_id__in.map(String).indexOf(String(r.project_id)) >= 0);
        return rs.sort((a, b) => a.published_at < b.published_at ? 1 : -1);
      } };
    return q; } };
  /* модуль «Лидерборд» считается открытым — от этого зависит возврат после закрытия отчёта */
  document.querySelectorAll('#app-ag .nav-i').forEach(n => n.classList.toggle('on', n.dataset.m === 'leaderboard'));
  _lbTab = 'smm';
  smmLbReset();
};
const show = () => { const c = document.getElementById('content-ag'); if (!c) return;
  document.body.appendChild(c);
  c.style.cssText = 'position:fixed;left:0;top:0;width:1560px;height:900px;overflow:auto;background:#0a0d0c;z-index:1;display:block;padding:20px'; };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup);
  await page.evaluate(async () => { await smmLoadLb(); renderLeaderboard(); });
  await page.evaluate(show);
  await page.waitForTimeout(1200);

  console.log('\n[A] строки ведут в свой отчёт');
  const rows = await page.evaluate(() => [...document.querySelectorAll('#content-ag .lb-oprow')].map(r => ({
    head: r.classList.contains('lb-ophead'), go: r.classList.contains('lb-opgo'),
    nm: (r.querySelector('.lb-opnm') || {}).textContent || null,
    onclick: r.getAttribute('onclick'), title: r.getAttribute('title'),
    role: r.getAttribute('role'), tab: r.getAttribute('tabindex'),
    cur: getComputedStyle(r).cursor, cells: r.children.length,
    cols: [...r.querySelectorAll('.lb-opc')].map(c => c.textContent.replace(/[ \s]+/g, ' ').trim()),
  })));
  console.log('    ' + JSON.stringify(rows, null, 1).slice(0, 900));
  const data = rows.filter(r => !r.head);
  ok('две строки проектов', data.length === 2, rows.length);
  ok('заголовок не кликабелен', rows[0].head && !rows[0].go && !rows[0].onclick, rows[0]);
  ok('каждая строка кликабельна', data.every(r => r.go && /smmOpenFromLb/.test(r.onclick || '')), data.map(r => r.onclick));
  ok('лидер ведёт в свой отчёт', /smmOpenFromLb\('r-p1-jul'\)/.test(data[0].onclick), data[0].onclick);
  ok('второй — в свой', /smmOpenFromLb\('r-p2-jul'\)/.test(data[1].onclick), data[1].onclick);
  ok('курсор-рука', data.every(r => r.cur === 'pointer'), data.map(r => r.cur));
  ok('доступно с клавиатуры', data.every(r => r.role === 'button' && r.tab === '0'), data.map(r => [r.role, r.tab]));
  ok('подсказка называет период и проект', /Июль 2026/.test(data[0].title || '') && /APOLO/.test(data[0].title || ''), data[0].title);
  ok('колонок в строке столько же, сколько в шапке', new Set(rows.map(r => r.cells)).size === 1, rows.map(r => r.cells));
  await page.screenshot({ path: '/tmp/work/shot_lb_rows.png', clip: await page.evaluate(() => {
    const b = document.querySelector('#content-ag .lb-oplist').getBoundingClientRect();
    return { x: b.x, y: Math.max(0, b.y), width: b.width, height: Math.min(b.height, 400) }; }) });

  console.log('\n[B] наведение подсказывает, что строка кликабельна');
  const hov = await page.evaluate(() => {
    const r = document.querySelectorAll('#content-ag .lb-oprow.lb-opgo')[0];
    const before = getComputedStyle(r.querySelector('.lb-opnm')).color;
    const bar = getComputedStyle(r, '::before');
    return { nameColor: before, barW: bar.width, barOpacity: bar.opacity };
  });
  ok('полоска слева есть, но скрыта до наведения', hov.barW === '3px' && hov.barOpacity === '0', hov);
  await page.hover('#content-ag .lb-oprow.lb-opgo');
  /* в headless переходы идут медленнее заявленных .18s — ждём результат, а не время */
  await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector('#content-ag .lb-oprow.lb-opgo'), '::before').opacity) > .9, null, { timeout: 4000 }).catch(() => {});
  const hov2 = await page.evaluate(() => {
    const r = document.querySelectorAll('#content-ag .lb-oprow.lb-opgo')[0];
    return { nameColor: getComputedStyle(r.querySelector('.lb-opnm')).color, barOpacity: getComputedStyle(r, '::before').opacity,
      isHover: r.matches(':hover'), hoverEls: [...document.querySelectorAll(':hover')].map(e => e.className || e.tagName).slice(-4) };
  });
  ok('на наведении полоска проявилась', parseFloat(hov2.barOpacity) > .9, hov2);
  ok('название подсветилось', hov2.nameColor !== hov.nameColor, [hov.nameColor, hov2.nameColor]);

  console.log('\n[C] клик открывает сам отчёт');
  await page.click('#content-ag .lb-oprow.lb-opgo');
  await page.waitForTimeout(400);
  const op = await page.evaluate(() => ({
    on: document.getElementById('ov-smm').classList.contains('on'),
    meta: _smmMeta && { id: _smmMeta.id, projectId: _smmMeta.projectId },
    tab: _smmTab,
    prevEr: _smmCur && _smmCur.prev ? _smmCur.prev.er : null,
    period: _smmCur ? _smmCur.period : null,
    poolN: Array.isArray(window._smmLbPool) ? window._smmLbPool.length : null,
    toast: window.__toast,
  }));
  console.log('    ' + JSON.stringify(op));
  ok('окно отчёта открылось', op.on, op);
  ok('открыт именно тот отчёт', op.meta && op.meta.id === 'r-p1-jul', op.meta);
  ok('попали внутрь отчёта, а не в форму ввода', op.tab === 'preview', op.tab);
  ok('загружен отчёт за тот же период, что в строке', op.period === 'Июль 2026', op.period);
  ok('сравнение с прошлым периодом подтянулось', op.prevEr === 11, op.prevEr);
  ok('соседние отчёты проекта загружены', op.poolN === 2, op.poolN);
  ok('без жалоб в тосте', !op.toast, op.toast);

  console.log('\n[C2] цифры в строке рейтинга и в отчёте — одни и те же');
  const rep = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('.smm-rep01 [data-count]').forEach(el => {
      const sib = el.previousElementSibling || el.nextElementSibling;
      out[(sib ? sib.textContent : '').replace(/[\s ]+/g, ' ').trim().toUpperCase()] = el.getAttribute('data-count');
    });
    const legend = [...document.querySelectorAll('.smm-rep01 .smm-stag:last-child span')].map(s => s.textContent.replace(/[\s ]+/g, ' ').trim());
    return { cells: out, legend, has01: !!document.querySelector('.smm-rep01') };
  });
  console.log('    ' + JSON.stringify(rep.cells));
  ok('презентация отрисовалась', rep.has01, rep);
  ok('охват в отчёте — аккаунтный итог', rep.cells['ОХВАТ'] === '897789', rep.cells['ОХВАТ']);
  ok('просмотры в отчёте — аккаунтный итог', rep.cells['ПРОСМОТРЫ'] === '1742736', rep.cells['ПРОСМОТРЫ']);
  ok('итог полосы форматов совпадает с просмотрами', rep.cells['ПРОСМОТРОВ ИТОГО'] === '1742736', rep.cells['ПРОСМОТРОВ ИТОГО']);
  const lbCols = data[0].cols;   /* колонки строки: охват · просмотры · подписчики */
  console.log('    строка рейтинга: ' + JSON.stringify(lbCols));
  const norm = s => String(s).replace(/[^\d]/g, '');
  ok('охват сходится со строкой рейтинга', norm(lbCols[0]) === rep.cells['ОХВАТ'], [lbCols[0], rep.cells['ОХВАТ']]);
  ok('просмотры сходятся со строкой рейтинга', norm(lbCols[1]) === rep.cells['ПРОСМОТРЫ'], [lbCols[1], rep.cells['ПРОСМОТРЫ']]);
  ok('посты показаны в разбивке по форматам', rep.legend.some(s => /^Посты$/.test(s)) && rep.legend.some(s => /^8 745$/.test(s)), rep.legend);
  await page.screenshot({ path: '/tmp/work/shot_smm_rep01.png', clip: await page.evaluate(() => {
    const b = document.querySelector('.smm-rep01').getBoundingClientRect();
    return { x: Math.max(0, b.x), y: Math.max(0, b.y), width: Math.min(b.width, 1600), height: Math.min(b.height, 900) }; }) });

  console.log('\n[D] закрыли отчёт — рейтинг вернулся');
  await page.evaluate(async () => { await smmClose(); });
  await page.waitForTimeout(1400);
  const back = await page.evaluate(() => ({
    off: !document.getElementById('ov-smm').classList.contains('on'),
    rows: document.querySelectorAll('#content-ag .lb-oprow.lb-opgo').length,
    pool: window._smmLbPool,
    txt: (document.querySelector('#content-ag .lb-load') || {}).textContent || null,
  }));
  console.log('    ' + JSON.stringify(back));
  ok('окно закрылось', back.off, back);
  ok('список рейтинга на месте, а не «Загрузка…»', back.rows === 2 && !back.txt, back);
  ok('временный кеш отчётов очищен', back.pool == null, back.pool);

  console.log('\n[E] отчёт недоступен — говорим честно');
  await page.evaluate(async () => { window.__toast = ''; window.__REPORTS = []; await smmOpenFromLb('r-p1-jul'); });
  await page.waitForTimeout(200);
  const t = await page.evaluate(() => ({ toast: window.__toast, on: document.getElementById('ov-smm').classList.contains('on') }));
  ok('объяснили, что отчёта нет', /не найден|закрыт доступом/i.test(t.toast || ''), t);
  ok('пустое окно не открылось', !t.on, t);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
  console.log('\n[F] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
