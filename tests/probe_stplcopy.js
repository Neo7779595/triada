/* probe_stplcopy — перенос этапов между тарифами в настройках шаблонов */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'detroyd', role: 'agency_owner', agency_id: 'AG' };
  window.tMe = () => window.__me;
  window.agIsOwner = () => true;
  window.__toast = ''; window.toast = t => { window.__toast = String(t); };
  window.LIVE = false;                      // без сети: пишем в локальный STAGE_TPL
  PROJECTS = [];
  if (typeof PROJECT_TAGS !== 'undefined') { PROJECT_TAGS.service = ['PROD', 'SMM']; PROJECT_TAGS.category = ['Ритейл']; }
  window.TARIFF_TPL = [
    { service: 'PROD', name: 'GOLD', price: 100, per: 'сум / мес', complexity: '' },
    { service: 'PROD', name: 'PLATINUM', price: 200, per: 'сум / мес', complexity: '' },
    { service: 'SMM', name: '', price: 0, per: '', complexity: '' },
  ];
  window.STAGE_TPL = {
    PROD: { '': ['Предпродакшн', 'Продакшн', 'Постпродакшн'], PLATINUM: ['Старый A', 'Старый B'] },
  };
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup);
  await page.evaluate(() => { openTemplatesSettings(); stplTab('service'); stplPickSvc('PROD'); });
  await page.waitForTimeout(300);

  console.log('\n[A] кнопка переноса');
  const btn = await page.evaluate(() => {
    const bs = [...document.querySelectorAll('#stpl-body .stpl-stage-acts button')].map(x => x.textContent.trim());
    return { btns: bs, tab: _stplTariff, stages: _stplStages.slice() };
  });
  console.log('    ' + JSON.stringify(btn));
  ok('на базовых этапах кнопка есть', btn.btns.some(t => /^Копировать$/.test(t)), btn.btns);
  ok('открыты базовые этапы услуги', btn.tab === '' && btn.stages.join('|') === 'Предпродакшн|Продакшн|Постпродакшн', btn);
  const noTf = await page.evaluate(() => { stplPickSvc('SMM'); const r = [...document.querySelectorAll('#stpl-body .stpl-stage-acts button')].map(x => x.textContent.trim()); stplPickSvc('PROD'); return r; });
  ok('у услуги без тарифов кнопки нет', !noTf.some(t => /^Копировать$/.test(t)), noTf);

  console.log('\n[B] список назначений');
  await page.evaluate(() => stplCopyToggle());
  await page.waitForTimeout(150);
  const list = await page.evaluate(() => ({
    h: (document.querySelector('#stpl-body .stpl-cp-h') || {}).textContent,
    rows: [...document.querySelectorAll('#stpl-body .stpl-cp-row')].map(r => ({
      nm: r.querySelector('.stpl-cp-nm').textContent, note: r.querySelector('.stpl-cp-note').textContent,
      warn: r.querySelector('.stpl-cp-note').classList.contains('warn'), on: r.classList.contains('on') })),
    apply: (document.querySelector('#stpl-body .stpl-cp-f .btn-add') || {}).textContent,
    disabled: !!(document.querySelector('#stpl-body .stpl-cp-f .btn-add') || {}).disabled,
  }));
  console.log('    ' + JSON.stringify(list, null, 1));
  ok('назначения — только другие тарифы', list.rows.map(r => r.nm).join('|') === 'GOLD|PLATINUM', list.rows.map(r => r.nm));
  ok('в заголовке — сколько этапов переносим', /3 этапа/.test(list.h || ''), list.h);
  ok('у тарифа со своими этапами предупреждение', list.rows[1].warn && /2 → заменим/.test(list.rows[1].note), list.rows[1]);
  ok('у пустого тарифа сказано, что он берёт базовые', /берёт базовые/.test(list.rows[0].note), list.rows[0]);
  ok('пока ничего не отмечено — перенос недоступен', list.disabled, list);

  console.log('\n[C] выбор и перенос');
  await page.evaluate(() => stplCopyAll());
  await page.waitForTimeout(120);
  const sel = await page.evaluate(() => ({
    on: [...document.querySelectorAll('#stpl-body .stpl-cp-row')].map(r => r.classList.contains('on')),
    apply: (document.querySelector('#stpl-body .stpl-cp-f .btn-add') || {}).textContent,
    disabled: !!(document.querySelector('#stpl-body .stpl-cp-f .btn-add') || {}).disabled,
    warn: (document.querySelector('#stpl-body .stpl-cp-warn') || {}).textContent,
  }));
  console.log('    ' + JSON.stringify(sel));
  ok('«Выбрать все» отметил оба', sel.on.every(Boolean), sel.on);
  ok('на кнопке видно количество', /Перенести в 2/.test(sel.apply || ''), sel.apply);
  ok('предупреждаем про перезапись', /перезаписано/.test(sel.warn || ''), sel.warn);
  await page.evaluate(async () => { await stplCopyRun(); });
  await page.waitForTimeout(250);
  const res = await page.evaluate(() => ({
    tpl: JSON.parse(JSON.stringify(window.STAGE_TPL.PROD)),
    toast: window.__toast, open: !!document.querySelector('#stpl-body .stpl-cp'),
  }));
  console.log('    ' + JSON.stringify(res));
  ok('GOLD получил список', (res.tpl.GOLD || []).join('|') === 'Предпродакшн|Продакшн|Постпродакшн', res.tpl.GOLD);
  ok('PLATINUM перезаписан', (res.tpl.PLATINUM || []).join('|') === 'Предпродакшн|Продакшн|Постпродакшн', res.tpl.PLATINUM);
  ok('базовые не пострадали', (res.tpl[''] || []).join('|') === 'Предпродакшн|Продакшн|Постпродакшн', res.tpl['']);
  ok('панель закрылась', !res.open, res.open);
  ok('сказали, куда перенесли', /GOLD/.test(res.toast) && /PLATINUM/.test(res.toast), res.toast);
  const shared = await page.evaluate(() => { window.STAGE_TPL.PROD.GOLD[0] = 'ПРАВКА'; return { gold: STAGE_TPL.PROD.GOLD[0], plat: STAGE_TPL.PROD.PLATINUM[0], base: STAGE_TPL.PROD[''][0] }; });
  ok('у каждого тарифа своя копия, а не общий список', shared.plat === 'Предпродакшн' && shared.base === 'Предпродакшн', shared);

  console.log('\n[D] перенос из тарифа обратно');
  await page.evaluate(() => { STAGE_TPL.PROD.GOLD = ['Только GOLD-1', 'Только GOLD-2']; stplPickSvc('PROD'); stplPickTariff('GOLD'); });
  await page.waitForTimeout(150);
  const t2 = await page.evaluate(() => { stplCopyToggle(); return [...document.querySelectorAll('#stpl-body .stpl-cp-row')].map(r => r.querySelector('.stpl-cp-nm').textContent); });
  ok('текущий тариф в назначениях не предлагается', t2.join('|') === 'Базовые этапы|PLATINUM', t2);
  await page.evaluate(async () => { stplCopyPick(1); await stplCopyRun(); });
  await page.waitForTimeout(200);
  const r2 = await page.evaluate(() => ({ plat: STAGE_TPL.PROD.PLATINUM.slice(), base: STAGE_TPL.PROD[''].slice(), gold: STAGE_TPL.PROD.GOLD.slice(), toast: window.__toast }));
  console.log('    ' + JSON.stringify(r2));
  ok('PLATINUM получил этапы GOLD', r2.plat.join('|') === 'Только GOLD-1|Только GOLD-2', r2.plat);
  ok('базовые не тронуты', r2.base.join('|') === 'Предпродакшн|Продакшн|Постпродакшн', r2.base);
  ok('исходный тариф сохранён как есть', r2.gold.join('|') === 'Только GOLD-1|Только GOLD-2', r2.gold);

  console.log('\n[E] переносить нечего');
  await page.evaluate(() => { STAGE_TPL.PROD.GOLD = []; stplPickTariff('GOLD'); stplCopyToggle(); window.__toast = ''; });
  await page.waitForTimeout(150);
  await page.evaluate(async () => { stplCopyPick(0); await stplCopyRun(); });
  await page.waitForTimeout(150);
  const e = await page.evaluate(() => ({ toast: window.__toast, base: STAGE_TPL.PROD[''].slice() }));
  ok('пустой список не затирает чужие этапы', e.base.join('|') === 'Предпродакшн|Продакшн|Постпродакшн', e);
  ok('объяснили, почему не перенеслось', /хотя бы один этап/.test(e.toast), e.toast);

  console.log('\n[F] смена услуги закрывает панель');
  await page.evaluate(() => { stplPickSvc('SMM'); });
  await page.waitForTimeout(120);
  ok('панель переноса не осталась открытой', await page.evaluate(() => !_stplCopyOpen && !document.querySelector('#stpl-body .stpl-cp')));

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
  console.log('\n[G] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
