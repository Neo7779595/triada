/* probe_pin — закрепление проектов и порядок «чем хуже, тем выше» */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'detroyd', role: 'agency_owner', agency_id: 'AG' };
  window.tMe = () => window.__me; window.toast = t => { window.__toast = t; };
  localStorage.removeItem('triada_pin_AG_u1');
  const P = (id, name, o) => Object.assign({ id, name, status: 'active', pct: 30, cat: '—', svc: '—',
    mrr: 0, cost: 0, lead_id: 'm1', _overdue: false, _overdueAll: 0, _lastActDays: 1, _nextDue: null,
    createdAt: '2026-06-01', logo: name[0], logoUrl: null, _stages: [], _tasks: [] }, o || {});
  PROJECTS = [
    P('p1', 'Спокойный'),
    P('p2', 'Просрочки', { _overdue: true, _overdueAll: 3 }),
    P('p3', 'Застой', { _lastActDays: 25 }),
    P('p4', 'Дедлайн завтра', { _nextDue: new Date(Date.now() + 86400000).toISOString().slice(0, 10), pct: 20 }),
    P('p5', 'Минус маржа', { mrr: 1000000, cost: 1400000 }),
    P('p6', 'Завершённый', { status: 'done', pct: 100 }),
  ];
  TEAM = [{ _id: 'm1', name: 'Иван', color: '#37E6C8' }];
  window._teamRaw = { tasks: [] }; window._timeLogs = []; window.tLoadTeam = async () => {};
  window._pjAggFallback = true;   /* агрегаты приходят с сервера — на стенде рисуем сразу */
  agFilter = 'all';
};
const names = () => [...document.querySelectorAll('#content-ag .pjh .pjh-name-t')].map(e => e.textContent.trim());

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1700, height: 950 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup);
  await page.evaluate(() => { renderProjects(); const c = document.getElementById('content-ag');
    document.body.appendChild(c); c.style.cssText = 'position:fixed;left:0;top:0;width:1680px;height:940px;overflow:auto;background:#0a0d0c;z-index:1;display:block;padding:16px'; });
  await page.waitForTimeout(250);

  console.log('\n[A] порядок по состоянию (по умолчанию)');
  const order = await page.evaluate(names);
  console.log('    ' + JSON.stringify(order));
  ok('сортировка по умолчанию — «По состоянию»', await page.evaluate(() => agSort === 'state'));
  ok('просрочки выше спокойного', order.indexOf('Просрочки') < order.indexOf('Спокойный'), order);
  ok('застой выше спокойного', order.indexOf('Застой') < order.indexOf('Спокойный'), order);
  ok('минус маржа выше спокойного', order.indexOf('Минус маржа') < order.indexOf('Спокойный'), order);
  ok('дедлайн завтра выше спокойного', order.indexOf('Дедлайн завтра') < order.indexOf('Спокойный'), order);
  ok('завершённый — в самом низу', order[order.length - 1] === 'Завершённый', order);
  ok('самый тяжёлый — первый', order[0] === 'Просрочки', order);

  console.log('\n[B] карточка без лишних плашек');
  const chips = await page.evaluate(() => ({
    why: document.querySelectorAll('#content-ag .pjh-why').length,
    headKids: [...document.querySelectorAll('#content-ag .pjh .pjh-head')].map(h => [...h.children].map(c => c.className.split(' ')[0])),
  }));
  console.log('    ' + JSON.stringify(chips));
  ok('оранжевой плашки «почему» нет', chips.why === 0, chips);
  ok('в шапке только название, булавка и шестерёнка', chips.headKids.every(k => k.join(',') === 'pjh-name,pjh-pin,pjh-set'), chips.headKids);

  console.log('\n[C] закрепление');
  const pinBtns = await page.evaluate(() => document.querySelectorAll('#content-ag .pjh-pin').length);
  ok('булавка на каждой карточке', pinBtns === 6, pinBtns);
  await page.evaluate(() => { const cards = [...document.querySelectorAll('#content-ag .pjh')];
    const calm = cards.find(c => c.querySelector('.pjh-name-t').textContent.trim() === 'Спокойный');
    calm.querySelector('.pjh-pin').click(); });
  await page.waitForTimeout(200);
  const after = await page.evaluate(names);
  console.log('    ' + JSON.stringify(after));
  ok('закреплённый встал первым', after[0] === 'Спокойный', after);
  ok('булавка подсвечена', await page.evaluate(() => document.querySelector('#content-ag .pjh').querySelector('.pjh-pin').classList.contains('on')));
  ok('карточка помечена', await page.evaluate(() => document.querySelector('#content-ag .pjh').classList.contains('is-pinned')));
  ok('тост объяснил', /закреплён/i.test(await page.evaluate(() => window.__toast || '')), await page.evaluate(() => window.__toast));
  ok('остальные сохранили порядок по состоянию', after.slice(1)[0] === 'Просрочки', after);
  ok('сохранилось в localStorage', await page.evaluate(() => (localStorage.getItem('triada_pin_AG_u1') || '').includes('p1')));

  console.log('\n[D] открепление');
  await page.evaluate(() => document.querySelector('#content-ag .pjh .pjh-pin').click());
  await page.waitForTimeout(200);
  const back = await page.evaluate(names);
  ok('вернулся в общий порядок', back[0] === 'Просрочки', back);
  ok('тост про открепление', /откреплён/i.test(await page.evaluate(() => window.__toast || '')));

  console.log('\n[E] закрепление переживает смену сортировки');
  await page.evaluate(() => { const cards = [...document.querySelectorAll('#content-ag .pjh')];
    cards.find(c => c.querySelector('.pjh-name-t').textContent.trim() === 'Спокойный').querySelector('.pjh-pin').click();
    setAgSort('name'); });
  await page.waitForTimeout(200);
  const byName = await page.evaluate(names);
  console.log('    ' + JSON.stringify(byName));
  ok('закреплённый первый и при сортировке по названию', byName[0] === 'Спокойный', byName);
  ok('остальные по алфавиту', byName.slice(1).join('|') === byName.slice(1).slice().sort((a, b) => a.localeCompare(b, 'ru')).join('|'), byName);
  ok('подписи «почему» только в режиме состояния', await page.evaluate(() => !document.querySelector('#content-ag .pjh-why')));

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
  console.log('\n[F] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
