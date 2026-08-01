/* probe_brief — в брифе можно набирать абзацы: Enter переводит строку, поле растёт */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const setup = () => {
  window.__me = { id: 'u1', full_name: 'detroyd', role: 'agency_owner', agency_id: 'AG' };
  window.tMe = () => window.__me; window.toast = t => { window.__toast = String(t); };
  window._BRIEFDOC = {};
  const B = briefNew('Бриф проекта');
  B.fields = [
    { id: 'f1', type: 'short', label: 'Расскажите о продукте', required: false },
    { id: 'f2', type: 'long', label: 'Целевая аудитория', required: false },
    { id: 'f3', type: 'email', label: 'Почта', required: false },
    { id: 'f4', type: 'number', label: 'Бюджет', required: false },
  ];
  B.answers = {};
  window.__brief = B;
  window.briefGet = () => B;
  const host = document.createElement('div');
  host.id = 'probe-host';
  host.style.cssText = 'position:fixed;left:0;top:0;width:900px;height:900px;overflow:auto;background:#0a0d0c;z-index:5;padding:24px';
  document.body.appendChild(host);
  host.innerHTML = briefClientFormHTML('p1', true);
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1000, height: 950 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup);
  await page.waitForTimeout(200);

  console.log('\n[A] чем набирают ответ');
  const kinds = await page.evaluate(() => [...document.querySelectorAll('#probe-host [data-fid]')].map(e => ({
    fid: e.getAttribute('data-fid'), tag: e.tagName, type: e.getAttribute('type') || '',
    h: Math.round(e.getBoundingClientRect().height) })));
  console.log('    ' + JSON.stringify(kinds));
  ok('короткий ответ — поле с переносом строк', kinds[0].tag === 'TEXTAREA', kinds[0]);
  ok('абзац — тоже', kinds[1].tag === 'TEXTAREA', kinds[1]);
  ok('почта осталась полем почты', kinds[2].tag === 'INPUT' && kinds[2].type === 'email', kinds[2]);
  ok('число осталось числом', kinds[3].tag === 'INPUT' && kinds[3].type === 'number', kinds[3]);
  ok('короткий ответ начинается с одной строки', kinds[0].h < kinds[1].h, kinds.map(k => k.h));

  console.log('\n[B] Enter переводит строку и поле растёт');
  const h0 = await page.evaluate(() => Math.round(document.querySelector('[data-fid="f1"]').getBoundingClientRect().height));
  /* превью-режим не пропускает клики мышью — ставим курсор и печатаем с клавиатуры */
  await page.evaluate(() => document.querySelector('[data-fid="f1"]').focus());
  await page.keyboard.type('Первая строка', { delay: 10 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('Вторая строка', { delay: 10 });
  await page.keyboard.press('Enter');
  await page.keyboard.type('Третья', { delay: 10 });
  await page.waitForTimeout(150);
  const typed = await page.evaluate(() => { const el = document.querySelector('[data-fid="f1"]');
    return { v: el.value, lines: el.value.split('\n').length, h: Math.round(el.getBoundingClientRect().height), focused: document.activeElement === el }; });
  console.log('    ' + JSON.stringify(typed));
  ok('перенос строки набрался', typed.lines === 3 && /Первая строка\nВторая строка\nТретья/.test(typed.v), typed);
  ok('поле выросло под текст', typed.h > h0 + 20, [h0, typed.h]);
  ok('фокус остался в поле', typed.focused, typed);

  console.log('\n[C] ответ сохраняется с переносами');
  const saved = await page.evaluate(() => {
    const el = document.querySelector('[data-fid="f1"]');
    const B = window.__brief; B.answers.f1 = el.value; B.answers.f2 = 'Абзац один\n\nАбзац два';
    return { f1: B.answers.f1, f2: B.answers.f2 };
  });
  ok('перенос дошёл до ответа', /\n/.test(saved.f1), saved.f1);

  console.log('\n[D] в паспорте переносы видны');
  const view = await page.evaluate(() => {
    const host = document.getElementById('probe-host');
    host.innerHTML = briefPassportHTML('p1');
    const vals = [...host.querySelectorAll('.bpass-val,.bpass-long')].map(e => ({
      cls: e.className, ws: getComputedStyle(e).whiteSpace, txt: e.textContent, h: Math.round(e.getBoundingClientRect().height) }));
    return vals;
  });
  console.log('    ' + JSON.stringify(view));
  const shortCell = view.find(v => /Первая строка/.test(v.txt));
  ok('короткий ответ показан целиком', !!shortCell, view.map(v => v.txt));
  ok('и переносы не схлопнулись', shortCell && shortCell.ws === 'pre-wrap', shortCell);
  ok('три строки занимают три строки', shortCell && shortCell.h > 40, shortCell);

  console.log('\n[E] уже написанный текст открывается развёрнутым');
  const reopened = await page.evaluate(() => {
    const host = document.getElementById('probe-host');
    host.innerHTML = briefClientFormHTML('p1', true);
    return new Promise(res => setTimeout(() => {
      const a = document.querySelector('[data-fid="f1"]'), b = document.querySelector('[data-fid="f2"]');
      res({ a: { rows: a.rows, h: Math.round(a.getBoundingClientRect().height), v: a.value },
            b: { rows: b.rows, h: Math.round(b.getBoundingClientRect().height), v: b.value } });
    }, 120));
  });
  console.log('    ' + JSON.stringify(reopened));
  ok('короткий ответ открылся на три строки', reopened.a.rows === 3 && reopened.a.h > 70, reopened.a);
  ok('текст на месте', /Первая строка/.test(reopened.a.v) && /Абзац два/.test(reopened.b.v), reopened);
  ok('абзац не ужался ниже трёх строк', reopened.b.h >= 70, reopened.b);

  const bad = errs.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
  console.log('\n[F] ошибки');
  ok('нет ошибок страницы', bad.length === 0, bad.slice(0, 3));

  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
