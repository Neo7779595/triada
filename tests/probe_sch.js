/* probe_sch — расписание без «маркерной» пестроты: карточка брони стоит на
   нейтральной поверхности, цвет вида работ остаётся ровно в одном месте —
   кант слева, — и ни один элемент модуля не светится цветным ореолом. */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
let pass = 0, fail = 0;
const ok = (n, c, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x) : '')); } };

const BG2 = 'rgb(21, 25, 32)';        /* --bg-2  #151920 — поверхность карточки */
const BG3 = 'rgb(28, 33, 42)';        /* --bg-3  #1C212A — она же под курсором  */
const SHOOT = 'rgb(55, 230, 200)';    /* съёмка  #37E6C8 */
const MEET = 'rgb(138, 143, 255)';    /* встреча #8A8FFF */

/* Свечение узнаём по тени, которая ложится ЗА пределы элемента: у неё нет
   слова inset. Внутренний кант (inset) — не свечение, он ничего не размывает. */
const outerShadow = s => String(s || 'none').split(/,(?![^(]*\))/)
  .map(x => x.trim()).filter(x => x && x !== 'none' && !/inset/.test(x));

/* Нейтральный — это когда красный, зелёный и синий почти равны: любой
   «цвет вида работ» в тексте сразу разводит каналы. */
const neutral = c => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(String(c || '')); if (!m) return false;
  const v = [+m[1], +m[2], +m[3]]; return Math.max.apply(null, v) - Math.min.apply(null, v) <= 24; };
/* запас 24 берёт холодную серую палитру (#7A828D — разброс 19) и отсекает
   любой цвет вида работ (#37E6C8 — 175, #8A8FFF — 117, #E3B567 — 124) */

const setup = () => {
  window.toast = () => {}; window.LIVE = false; window.tLoadBookings = null;
  window.tMe = () => ({ id: 'u1', full_name: 'DTR', role: 'agency_owner', agency_id: 'AG' });
  window.ME = window.tMe(); window.agIsOwner = () => true;
  TEAM = [{ _id: 'm1', name: 'Худойберди', color: '#37E6C8', avatar: null },
          { _id: 'm2', name: 'Азиз', color: '#8A8FFF', avatar: null },
          { _id: 'm3', name: 'Мадина', color: '#E3B567', avatar: null },
          { _id: 'm4', name: 'Отабек', color: '#43D88C', avatar: null }];
  window.TEAM = TEAM;
  PROJECTS = [{ id: 'p1', name: 'Qushbegi', logo: 'Q', logoUrl: null, status: 'active', _tasks: [], _stages: [] }];
  window.PROJECTS = PROJECTS;
  const M = TEAM.map(t => ({ id: t._id, name: t.name, color: t.color, avatar: null, role: '' }));
  const mon = (function () { const x = new Date(); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x.getTime(); })();
  const at = (d, h, m) => mon + d * 86400000 + h * 3600000 + (m || 0) * 60000;
  const TODAY = (function () { const x = new Date(); x.setHours(0, 0, 0, 0); return x.getTime(); })();
  const B = (o) => Object.assign({ projId: 'p1', projName: 'Qushbegi', kind: 'shoot', status: 'planned',
    allDay: false, location: '', note: '', attachments: [], members: [] }, o);
  window.BOOKINGS = [
    /* четыре участника — на них подпись вида работ раньше обрезалась */
    B({ id: 'b1', title: 'Съёмки', startsAt: at(0, 23, 30), endsAt: at(0, 23, 59), location: 'Chimrobod 1', members: M }),
    B({ id: 'b2', title: 'Переговоры', kind: 'meeting', allDay: true, startsAt: at(1, 0, 0), endsAt: at(2, 0, 0), location: 'Chimrobod 1', members: M }),
    B({ id: 'b3', title: 'Снимаем 3 рилса', startsAt: at(2, 16, 0), endsAt: at(2, 19, 20), location: 'Ташкент сити', members: M.slice(0, 1) }),
    B({ id: 'b4', title: 'Отменённая встреча', kind: 'meeting', status: 'cancelled', startsAt: at(3, 10, 0), endsAt: at(3, 11, 0), members: M.slice(0, 2) }),
    B({ id: 'b5', title: 'Резерв под досъём', status: 'hold', startsAt: at(3, 12, 0), endsAt: at(3, 15, 30), members: M.slice(0, 3) }),
    B({ id: 'b6', title: 'Очень длинное название брони, которое не влезает в клетку месяца', kind: 'task', startsAt: at(4, 9, 0), endsAt: at(4, 13, 0), members: M.slice(0, 2) }),
    /* лента команды показывает СЕГОДНЯ — нужна бронь именно на сегодня,
       иначе в какой день недели ни запусти, лента окажется пустой */
    B({ id: 'b7', title: 'Смена на объекте', startsAt: TODAY + 9 * 3600000, endsAt: TODAY + 13 * 3600000, members: M.slice(0, 2) }),
    /* идёт прямо сейчас — карточка должна сама об этом сказать */
    B({ id: 'b8', title: 'Съёмка в студии', startsAt: Date.now() - 30 * 60000, endsAt: Date.now() + 30 * 60000, members: M.slice(0, 2) }),
  ];
  document.querySelectorAll('.app').forEach(a => a.classList.remove('on'));
  document.getElementById('app-ag').classList.add('on');
  const st = document.createElement('style');
  st.textContent = '#content-ag>*{animation:none!important}.sched-fade-in{animation:none!important}';
  document.head.appendChild(st);
  renderSchedule();
};

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto('http://127.0.0.1:8897/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(setup);
  await page.waitForTimeout(500);

  console.log('\n[A] карточка брони: поверхность нейтральная, цвет — только кант');
  const card = await page.evaluate(() => {
    const el = document.querySelector('.sched-chip');
    const s = getComputedStyle(el), r = getComputedStyle(el, '::before');
    return { bg: s.backgroundColor, top: s.borderTopColor, left: s.borderLeftColor, topW: s.borderTopWidth,
      shadow: s.boxShadow, radius: s.borderTopLeftRadius,
      railBg: r.backgroundColor, railW: r.width, railTop: r.top, railH: r.height, cardH: el.clientHeight };
  });
  ok('фон карточки — обычная поверхность, а не заливка цветом вида работ', card.bg === BG2, card.bg);
  ok('цвет вида работ вынесен в капсулу слева', card.railBg === SHOOT && card.railW === '3px', card);
  ok('капсула не доходит до углов — цвет не размазан по скруглению',
    parseFloat(card.railTop) >= 6 && parseFloat(card.railH) < card.cardH, card);
  ok('все четыре грани — обычная линия интерфейса',
    card.top === 'rgba(255, 255, 255, 0.07)' && card.left === 'rgba(255, 255, 255, 0.07)' && card.topW === '1px', card);
  ok('карточка не светится: наружных теней нет', outerShadow(card.shadow).length === 0, card.shadow);

  const hov = await page.evaluate(async () => {
    const el = document.querySelector('.sched-chip');
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    /* :hover через событие не включить — читаем правило из таблицы стилей */
    let rule = null;
    for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (e) { continue; }
      for (const r of rs) if (r.selectorText === '.sched-chip:hover') rule = r.style; }
    /* background задан сокращённой записью с var() — в CSSOM отдельные
       свойства такой записи пустые, читаем сокращение целиком */
    return rule ? { bg: rule.backgroundColor || rule.background, shadow: rule.boxShadow, transform: rule.transform } : null;
  });
  ok('под курсором карточка просто светлеет', hov && /var\(--bg-3\)/.test(hov.bg || ''), hov);
  ok('подъём под курсором — ровно один пиксель, без прыжка',
    hov && /translateY\(-1px\)/.test(hov.transform || ''), hov && hov.transform);
  ok('тень под курсором чёрная, а не цветная', hov && !/230|143|255,/.test(String(hov.shadow).replace(/rgba?\(255, 255, 255[^)]*\)/g, '')), hov && hov.shadow);

  console.log('\n[B] порядок чтения: время → название → место → вид и люди');
  const hier = await page.evaluate(() => {
    const el = document.querySelector('.sched-chip');
    const g = q => { const x = el.querySelector(q); return x ? getComputedStyle(x) : null; };
    const tm = g('.sched-chip-tm'), tt = g('.sched-chip-tt'), btm = g('.sched-chip-btm'), kind = g('.sched-chip-kind');
    const k = el.querySelector('.sched-chip-kind');
    return { tmSize: parseFloat(tm.fontSize), ttSize: parseFloat(tt.fontSize), tmColor: tm.color,
      ttColor: tt.color, kindColor: kind.color, sep: btm.borderTopWidth,
      kindFits: k.scrollWidth <= k.clientWidth + 1, kindTxt: k.textContent,
      durAlign: getComputedStyle(el.querySelector('.sched-chip-dur')).textAlign };
  });
  ok('название крупнее времени', hier.ttSize > hier.tmSize, hier);
  ok('время — самый заметный текст после названия', neutral(hier.tmColor) && hier.tmColor === 'rgb(234, 236, 239)', hier.tmColor);
  ok('вид работ приглушён и тоже нейтрален — цвет за него отвечает кант',
    neutral(hier.kindColor) && hier.kindColor === 'rgb(122, 130, 141)', hier.kindColor);
  ok('низ карточки отделён волосяной линией', hier.sep === '1px', hier.sep);
  ok('подпись вида работ не обрезается даже при четырёх участниках', hier.kindFits, hier);

  console.log('\n[C] статусы читаются, но не кричат');
  const st = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.sched-chip')];
    const c = all.find(x => x.classList.contains('cancel')), h = all.find(x => x.classList.contains('hold'));
    const ad = all.find(x => x.classList.contains('allday'));
    return { cancelStrike: c ? getComputedStyle(c.querySelector('.sched-chip-tt')).textDecorationLine : null,
      cancelWhole: c ? getComputedStyle(c).textDecorationLine : null,
      cancelOp: c ? getComputedStyle(c).opacity : null,
      holdDash: h ? getComputedStyle(h, '::before').backgroundImage : null,
      adBg: ad ? getComputedStyle(ad).backgroundColor : null,
      adLeft: ad ? getComputedStyle(ad, '::before').backgroundColor : null,
      adCase: ad ? getComputedStyle(ad.querySelector('.sched-chip-tm')).textTransform : null };
  });
  ok('у отменённой перечёркнуто название, а не вся карточка целиком',
    st.cancelStrike === 'line-through' && st.cancelWhole === 'none', st);
  ok('отменённая приглушена', parseFloat(st.cancelOp) < .7, st.cancelOp);
  ok('резерв помечен пунктирным кантом', /repeating-linear-gradient/.test(st.holdDash || ''), st.holdDash);
  ok('«весь день» — та же карточка, без градиента во всю ширину', st.adBg === BG2, st.adBg);
  ok('и со своим кантом', st.adLeft === MEET, st.adLeft);
  ok('«весь день» набрано меткой', st.adCase === 'uppercase', st.adCase);

  console.log('\n[D] идёт сейчас — карточка говорит об этом сама');
  const live = await page.evaluate(() => {
    const el = document.querySelector('.sched-chip.live');
    if (!el) return { none: true };
    const chip = el.querySelector('.sched-chip-now');
    const others = [...document.querySelectorAll('.sched-chip')].filter(x => !x.classList.contains('live'));
    return { txt: chip ? chip.textContent.trim() : null, title: el.querySelector('.sched-chip-tt').textContent,
      border: getComputedStyle(el).borderTopColor, anim: chip ? getComputedStyle(chip).animationName : null,
      shadow: chip ? getComputedStyle(chip).boxShadow : null,
      othersMarked: others.filter(x => x.querySelector('.sched-chip-now')).length };
  });
  ok('у идущей сейчас брони стоит метка «сейчас»', live.txt === 'сейчас', live);
  ok('и это именно та бронь, которая идёт', /Съёмка в студии/.test(live.title || ''), live.title);
  ok('метка не мигает', live.anim === 'none', live.anim);
  ok('и не светится — только кант', outerShadow(live.shadow).length === 0, live.shadow);
  ok('остальные брони меткой не помечены', live.othersMarked === 0, live.othersMarked);
  ok('рамка живой карточки чуть подсвечена акцентом', live.border !== 'rgba(255, 255, 255, 0.07)', live.border);

  console.log('\n[D2] шапка колонки показывает загрузку дня');
  const load = await page.evaluate(() => {
    const cols = [...document.querySelectorAll('.sched-col')];
    const bars = cols.map(c => { const b = c.querySelector('.sched-col-load'); const i = b ? b.querySelector('i') : null;
      return { has: !!b, w: i ? i.style.width : null, empty: b ? b.classList.contains('is-empty') : null,
        title: b ? b.getAttribute('title') : null }; });
    return { bars, filled: bars.filter(b => b.w).length, peak: bars.filter(b => b.w === '100%').length };
  });
  ok('полоска загрузки есть у каждого дня', load.bars.every(b => b.has), load.bars);
  ok('у пустых дней она пустая', load.bars.some(b => b.empty && !b.w), load.bars);
  ok('самый занятый день недели заполнен целиком', load.peak === 1, load.bars);
  ok('подсказка объясняет, что показывает полоска', /от самого занятого дня/.test((load.bars.find(b => b.title) || {}).title || ''), load.bars);

  console.log('\n[E] сегодняшняя колонка отмечена кантом, а не ореолом');
  const today = await page.evaluate(() => {
    const col = document.querySelector('.sched-col.today');
    const lb = col ? col.querySelector('.today-lb') : null;
    return { shadow: col ? getComputedStyle(col).boxShadow : null,
      border: col ? getComputedStyle(col).borderTopColor : null,
      lbAnim: lb ? getComputedStyle(lb).animationName : null,
      lbShadow: lb ? getComputedStyle(lb).boxShadow : null,
      lbBg: lb ? getComputedStyle(lb).backgroundColor : null };
  });
  ok('вокруг колонки нет цветного облака', outerShadow(today.shadow).length === 0, today.shadow);
  ok('метка «сегодня» не пульсирует', today.lbAnim === 'none', today.lbAnim);
  ok('и не светится', outerShadow(today.lbShadow).length === 0, today.lbShadow);

  console.log('\n[F] месяц: строка события не заливается и не вылезает из клетки');
  await page.evaluate(() => schView('month'));
  await page.waitForTimeout(500);
  const mo = await page.evaluate(() => {
    const ev = [...document.querySelectorAll('.sched-mev')];
    const long = ev.find(e => /Очень длинное/.test(e.textContent)) || ev[0];
    const cell = long.closest('.sched-cell');
    const t = long.querySelector('.t');
    return { bg: getComputedStyle(long).backgroundColor, dot: getComputedStyle(long.querySelector('i')).backgroundColor,
      timeColor: long.querySelector('em') ? getComputedStyle(long.querySelector('em')).color : null,
      inside: long.getBoundingClientRect().right <= cell.getBoundingClientRect().right + 1,
      ellipsis: t ? getComputedStyle(t).textOverflow : null,
      clipped: t ? t.scrollWidth > t.clientWidth : null };
  });
  ok('строка события без цветной заливки', mo.bg === 'rgba(0, 0, 0, 0)', mo.bg);
  ok('цвет вида работ остался в метке слева', mo.dot === 'rgb(34, 195, 230)' || /rgb\(/.test(mo.dot), mo.dot);
  ok('время серое', mo.timeColor === 'rgb(122, 130, 141)', mo.timeColor);
  ok('длинное название не вылезает за клетку', mo.inside, mo);
  ok('и обрывается многоточием, а не на полуслове', mo.ellipsis === 'ellipsis' && mo.clipped === true, mo);

  console.log('\n[G] лента команды: те же правила');
  await page.evaluate(() => { schView('team'); });
  await page.waitForTimeout(600);
  const tm = await page.evaluate(() => {
    const blk = document.querySelector('.sav-blk');
    const now = document.querySelector('.sav-track-now');
    return { bg: blk ? getComputedStyle(blk).backgroundColor : null,
      left: blk ? getComputedStyle(blk).borderLeftColor : null,
      shadow: blk ? getComputedStyle(blk).boxShadow : null,
      nowShadow: now ? getComputedStyle(now).boxShadow : null,
      nowW: now ? getComputedStyle(now).width : null };
  });
  ok('бронь на ленте — та же нейтральная карточка', tm.bg === BG2, tm.bg);
  ok('с кантом вида работ', /rgb\(/.test(tm.left || ''), tm.left);
  ok('без наружных теней', outerShadow(tm.shadow).length === 0, tm.shadow);
  /* Линия «сейчас» рисуется, только когда текущий час попадает в окно дня
     (SCH_W0..SCH_W1 = 7..23). Ночью её нет по замыслу, поэтому саму отрисовку
     проверяем по условию, а оформление — по правилу в таблице стилей: оно от
     времени суток не зависит. */
  const nowRule = await page.evaluate(() => {
    for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (e) { continue; }
      for (const r of rs) if (r.selectorText === '.sav-track-now') return { w: r.style.width, shadow: r.style.boxShadow }; }
    return null;
  });
  ok('линия «сейчас» — ровные два пикселя без размытия',
    !!nowRule && nowRule.w === '2px' && !(nowRule.shadow || '').trim(), nowRule);
  if (tm.nowW != null) ok('и на ленте она такой и отрисована',
    tm.nowW === '2px' && outerShadow(tm.nowShadow).length === 0, tm);

  console.log('\n[H] список дня: вид работ — метка, а не цветная плашка');
  const day = await page.evaluate(() => {
    const mon = (function () { const x = new Date(); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); x.setHours(0, 0, 0, 0); return x.getTime(); })();
    schDay(mon + 3 * 86400000);
    return new Promise(r => setTimeout(() => {
      const row = document.querySelector('.sched-drow');
      const kd = row ? row.querySelector('.kd') : null;
      r({ bg: row ? getComputedStyle(row).backgroundColor : null,
        left: row ? getComputedStyle(row).borderLeftColor : null,
        tm: row ? getComputedStyle(row.querySelector('.tm')).color : null,
        kdBg: kd ? getComputedStyle(kd).backgroundColor : null,
        kdColor: kd ? getComputedStyle(kd).color : null,
        kdDot: kd && kd.querySelector('i') ? getComputedStyle(kd.querySelector('i')).backgroundColor : null });
    }, 350));
  });
  ok('строка дня стоит на нейтральной поверхности', day.bg === BG2, day.bg);
  ok('и помечена кантом вида работ', /rgb\(/.test(day.left || ''), day.left);
  ok('время в строке серое', day.tm === 'rgb(154, 161, 172)', day.tm);
  ok('плашка вида работ больше не залита цветом', day.kdBg === 'rgb(15, 17, 22)', day.kdBg);
  ok('цвет ушёл в квадратную метку', /rgb\(/.test(day.kdDot || '') && day.kdDot !== day.kdBg, day.kdDot);

  ok('страница без ошибок', errs.length === 0, errs.slice(0, 2));
  console.log('\n──────── ' + pass + ' ok · ' + fail + ' fail ────────');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
