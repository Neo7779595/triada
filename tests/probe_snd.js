/* probe_snd — звук уведомлений: свои мелодии файлами вместо синтеза.
   Семь дорожек DTR SONG 1…7, каждая реально отдаётся сервером и играет;
   от прежнего идиофона не осталось ни функции, ни настройки. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const got = []; page.on('response', r => { if (/\/snd\//.test(r.url())) got.push([r.url().split('/').pop(), r.status(), r.headers()['content-type'] || '']); });
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);

  console.log('\n[A] банк мелодий');
  const bank = await page.evaluate(() => Object.keys(NTF_TONES).map(k => ({ k, l: NTF_TONES[k].l, src: NTF_TONES[k].src, d: NTF_TONES[k].d, notes: !!NTF_TONES[k].notes })));
  ok('мелодий ровно семь', bank.length === 7, bank.length);
  ok('названы по порядку DTR SONG 1…7',
    bank.map(t => t.l).join(' | ') === 'DTR SONG 1 | DTR SONG 2 | DTR SONG 3 | DTR SONG 4 | DTR SONG 5 | DTR SONG 6 | DTR SONG 7', bank.map(t => t.l));
  ok('каждая — отдельный файл в /snd', bank.every((t, i) => t.src === '/snd/dtr-' + (i + 1) + '.mp3'), bank.map(t => t.src));
  ok('у каждой подписана длительность', bank.every(t => /^\d+,\d+ с$/.test(t.d)), bank.map(t => t.d));
  ok('от синтеза не осталось нот', bank.every(t => !t.notes), bank);

  const gone = await page.evaluate(() => ({ ctx: typeof _ntfCtx, bell: typeof _ntfBell, mallet: typeof _ntfMallet,
    sched: typeof _ntfSchedule, partials: typeof _NTF_PARTIALS, ac: typeof _ntfAC, play: typeof ntfPlay }));
  ok('синтезатор удалён целиком — ни контекста, ни колокола, ни партиалов',
    ['ctx', 'bell', 'mallet', 'sched', 'partials', 'ac'].every(k => gone[k] === 'undefined'), gone);
  ok('проигрыватель на месте', gone.play === 'function', gone.play);

  console.log('\n[B] файлы действительно отдаются');
  await page.mouse.click(5, 5);                       // без жеста браузер звук не пустит
  await page.waitForTimeout(300);
  const played = await page.evaluate(async () => {
    const out = [];
    for (const k of Object.keys(NTF_TONES)) {
      ntfPlay(k, 0.05);
      await new Promise(r => setTimeout(r, 220));
      const a = _ntfEls[k];
      out.push({ k, dur: a ? Math.round(a.duration * 10) / 10 : null, playing: a ? !a.paused : false,
        err: a && a.error ? a.error.code : null, vol: a ? a.volume : null });
    }
    return out;
  });
  ok('все семь заиграли', played.every(p => p.playing), played.filter(p => !p.playing));
  ok('ни одна не сломана', played.every(p => !p.err), played.filter(p => p.err));
  ok('длительности похожи на настоящие (0,8–3,8 с)', played.every(p => p.dur > 0.5 && p.dur < 4.2), played.map(p => p.dur));
  ok('громкость передаётся в дорожку', played.every(p => Math.abs(p.vol - 0.05) < 0.001), played.map(p => p.vol));
  ok('сервер отдал все семь файлов', got.filter(g => g[1] === 200).length === 7, got);
  ok('и отдал именно звук', got.every(g => /audio|mpeg/.test(g[2])), got.map(g => g[2]));

  console.log('\n[C] тишина остаётся тишиной');
  const mute = await page.evaluate(async () => {
    const a = _ntfEls.dtr1; a.pause(); a.currentTime = 0;
    ntfPlay('dtr1', 0);
    await new Promise(r => setTimeout(r, 150));
    const atZero = a.paused;
    NTF_SND.on = false; const before = _ntfLastSnd;
    ntfSound({ kind: 'task', evt: 'create', sev: 'info' });
    const afterOff = _ntfLastSnd === before;
    NTF_SND.on = true;
    return { atZero, afterOff };
  });
  ok('нулевая громкость ничего не проигрывает', mute.atZero, mute);
  ok('выключенный звук не проигрывает вовсе', mute.afterOff, mute);

  console.log('\n[D] какое событие каким голосом говорит');
  const map = await page.evaluate(() => ({
    def: NTF_SND.tone, crit: NTF_SND.critTone, semi: NTF_SEMI,
    forCreate: _ntfToneFor({ evt: 'create', sev: 'info' }),
    forDone: _ntfToneFor({ evt: 'done', sev: 'info' }),
    forPub: _ntfToneFor({ evt: 'publish', sev: 'info' }),
    forPerson: _ntfToneFor({ evt: 'person', sev: 'info' }),
    forCrit: _ntfToneFor({ evt: 'done', sev: 'crit' }),
  }));
  ok('по умолчанию звучит первая мелодия', map.def === 'dtr1', map.def);
  ok('важное — вторая', map.crit === 'dtr2', map.crit);
  ok('обычное событие берёт выбранную мелодию', map.forCreate === map.def, map);
  ok('завершение, публикация и новый человек — свои', map.forDone === 'dtr3' && map.forPub === 'dtr4' && map.forPerson === 'dtr5', map);
  ok('важное перебивает смысловой отклик', map.forCrit === map.crit, map);

  console.log('\n[E] пачка событий — один звук');
  const thr = await page.evaluate(async () => {
    _ntfLastSnd = 0;
    const e = { kind: 'task', evt: 'create', sev: 'info' };
    ntfSound(e); const first = _ntfLastSnd;
    await new Promise(r => setTimeout(r, 60));
    ntfSound(e); const second = _ntfLastSnd;
    return { first: first > 0, same: first === second };
  });
  ok('первое событие звучит', thr.first, thr);
  ok('второе подряд — молчит', thr.same, thr);

  console.log('\n[F] старая настройка не оставляет без звука');
  const legacy = await page.evaluate(() => {
    const key = 'ntf_snd_' + ((((window.tMe && window.tMe()) || {}).agency_id) || 'x');
    localStorage.setItem(key, JSON.stringify({ on: true, vol: .7, tone: 'aurora', critTone: 'focus', critOnly: false, kinds: {} }));
    ntfSndLoad();
    const r = { tone: NTF_SND.tone, crit: NTF_SND.critTone, vol: NTF_SND.vol };
    localStorage.removeItem(key); ntfSndLoad();
    return r;
  });
  ok('исчезнувшая «Аврора» подменяется первой дорожкой', legacy.tone === 'dtr1', legacy);
  ok('исчезнувший «Фокус» — второй', legacy.crit === 'dtr2', legacy);
  ok('громкость при этом сохраняется', legacy.vol === 0.7, legacy.vol);

  console.log('\n[G] экран настроек говорит то же, что слышно');
  const ui = await page.evaluate(() => {
    window.toast = () => {}; window.LIVE = false;
    window.tMe = () => ({ id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' });
    window.ME = window.tMe();
    document.querySelectorAll('.app').forEach(a => a.classList.remove('on'));
    document.getElementById('app-ag').classList.add('on');
    ntfSndLoad(); ntfMount(); ntfOpen(); ntfView('set');
    const p = document.querySelector('.ntf-panel');
    const names = [...p.querySelectorAll('.ntf-tone .tx b')].map(e => e.textContent);
    return { uniq: [...new Set(names)].join(','), lists: names.length,
      on: [...p.querySelectorAll('.ntf-tone.on .tx b')].map(e => e.textContent),
      semis: [...p.querySelectorAll('.ntf-semi span')].map(e => e.textContent),
      note: ([...p.querySelectorAll('.ntf-note')].pop() || {}).textContent || '' };
  });
  ok('в списках только свои мелодии', ui.uniq === 'DTR SONG 1,DTR SONG 2,DTR SONG 3,DTR SONG 4,DTR SONG 5,DTR SONG 6,DTR SONG 7', ui.uniq);
  ok('списка два — обычные события и важные', ui.lists === 14, ui.lists);
  ok('выбранные отмечены', ui.on.join(' · ') === 'DTR SONG 1 · DTR SONG 2', ui.on);
  ok('смысловые отклики подписаны своими мелодиями', ui.semis.join(' · ') === 'DTR SONG 3 · DTR SONG 4 · DTR SONG 5', ui.semis);
  ok('подпись внизу больше не обещает синтез', !/синтезируется|обертон/i.test(ui.note) && /файл/i.test(ui.note), ui.note.slice(0, 70));

  ok('страница без ошибок', errs.length === 0, errs.slice(0, 2));
  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
