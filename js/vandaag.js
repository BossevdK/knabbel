/* The Today page, "Kan dit?", asking Knabbel, workouts and the tip of the week. */
/* ---------- today ---------- */
/* Rings and bars grow from their previous value (or from empty the first time) to the new one. */
const motionPrev = {};
function motionFrom(key, to, empty){ if (!key) return to; const f = key in motionPrev ? motionPrev[key] : empty; motionPrev[key] = to; return f; }
function animateIn(){
  sweepRings();
  const els = document.querySelectorAll('[data-to],[data-w],[data-h],[data-rot],[data-fill]'); if (!els.length) return;
  void document.body.offsetWidth;  // let the browser take the start values first, so the change animates
  els.forEach(el => {
    if (el.dataset.rot != null) { el.style.transform = `rotate(${el.dataset.rot}deg)`; el.removeAttribute('data-rot'); }
    else if (el.dataset.fill != null) { el.style.fill = el.dataset.fill; el.removeAttribute('data-fill'); }
    else if (el.dataset.to != null) { el.style.strokeDashoffset = el.dataset.to; el.removeAttribute('data-to'); }
    else if (el.dataset.h != null) { el.style.height = el.dataset.h; el.removeAttribute('data-h'); }
    else { el.style.width = el.dataset.w; el.removeAttribute('data-w'); }
  });
}
/* How far round an arc is, in degrees, from its dash offset (c = the full circle). */
const ringDeg = (off, c) => ((1 - off / c) * 360).toFixed(2);
/* lap: over the goal the ring goes on for a second round, up to twice the goal, so 105% and 150% don't look the same
   (see gradRing). Without the colour steps (grad off) the ring steps back to a soft tint with a red round over it. */
function ringSVG(frac, color, size = 148, stroke = 14, key, mark, grad, lap){
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, h = size / 2;
  const o = lap ? clamp(frac - 1, 0, 1) : 0;
  const lapSVG = (paint = 'var(--bad)') => {
    if (!(o > 0)) return '';
    const to = c * (1 - o), from = motionFrom(key && key + 'o', to, c);
    // Round start at the top, round end with a soft shadow in front of it (turning along with the arc), so the lap
    // reads as lying on the ring.
    return `<circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="${paint}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" ${key ? `data-mk="${key}o"` : ''} style="stroke-dashoffset:${from}" ${key ? `data-to="${to}"` : ''}/>
      <g class="ringhead" style="transform:rotate(${ringDeg(from, c)}deg)" data-rot="${ringDeg(to, c)}"><circle cx="${h + r}" cy="${h + 1.5}" r="${stroke / 2 + 1}" fill="rgb(0 0 0/.22)"/><circle cx="${h + r}" cy="${h}" r="${stroke / 2}" fill="${paint}"/></g>`;
  };
  const tick = mark > 0 && mark < 1 ? (() => { const a = mark * 2 * Math.PI, x1 = h + (r - stroke / 2 - 2) * Math.cos(a), y1 = h + (r - stroke / 2 - 2) * Math.sin(a), x2 = h + (r + stroke / 2 + 2) * Math.cos(a), y2 = h + (r + stroke / 2 + 2) * Math.sin(a);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--ink)" stroke-width="3" stroke-linecap="round" opacity=".55"/>`; })() : '';
  return `<svg viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="color-mix(in srgb,var(--ink) 12%,var(--surface))" stroke-width="${stroke}"/>
    ${(() => {
      const to = c * (1 - clamp(frac, 0, 1)), from = motionFrom(key, to, c);
      const arc = paint => `<circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="${paint}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" ${key ? `data-mk="${key}"` : ''} style="stroke-dashoffset:${from}" ${key ? `data-to="${to}"` : ''}/>`;
      if (!grad) return arc(o > 0 ? `color-mix(in srgb,${color} 45%,var(--surface))` : color) + lapSVG();
      return gradRing(frac, color, size, stroke, key, lap, r, c, h);
    })()}${tick}</svg>`;
}
/* The calorie ring: a mask over a ring that darkens step by step from the start to the end. Over the goal (lap) it goes
   on for a second round, drawn the same way: it starts at the top in the very colour the first round ends in, so it
   flows on from it, and is fully red after a short stretch (4% of the ring), so you see clearly where it ends. The
   colour belongs to the place on the ring, not to how far over you are: from 103% to 110% only the red part grows.
   It moves as one sweep (see sweepRings): from where it was, round the first round and on into the second in one smooth
   motion, instead of both rounds starting at the top at the same time. */
const ringMemo = new Map();   // see gradRing
const ringShade = (color, i, N) => `color-mix(in srgb,${color} ${r0(100 - 45 * i / (N - 1))}%,var(--ink))`;
const sweepLive = {};   // rings that are moving right now: key → how far round (0 to 2), for captureMotion
function gradRing(frac, color, size, stroke, key, lap, r, c, h){
  const N = 72, M = 360, cap = stroke / 2 / r, id = 'rg' + (key || 'x').replace(/\W/g, ''), pt = a => `${(h + r * Math.cos(a)).toFixed(2)} ${(h + r * Math.sin(a)).toFixed(2)}`;
  const F = clamp(frac, 0, lap ? 2 : 1), F0 = key ? motionFrom(key + 'f', F, 0) : F;
  const seg = (a0, a1, paint) => `<path d="M ${pt(a0)} A ${r} ${r} 0 0 1 ${pt(a1)}" fill="none" stroke="${paint}" stroke-width="${stroke + 2}"/>`;
  // The first round in 72 steps. Its start reaches back under the round start (cap) only while it is the only round:
  // over the goal that piece showed as a thin orange edge, and the second round's round start covers that spot.
  const mk = `${color}|${size}|${stroke}`, memo = ringMemo.get(mk) || ringMemo.set(mk, { lap: new Map() }).get(mk);
  const full = memo.full ||= Array.from({ length: N }, (_, j) => N - 1 - j).map(i => seg(i / N * 2 * Math.PI - (i ? 0.01 : 0), (i + 1) / N * 2 * Math.PI, ringShade(color, i, N))).join('');
  const startCap = memo.cap ||= seg(-cap, 0.01, ringShade(color, 0, N));
  // The second round in 1-degree steps (no bands in the change to red), running on under the whole round tip.
  const oMax = Math.max(F, F0) - 1, lapC = j => `color-mix(in srgb,var(--bad) ${r0(clamp(j / (M * 0.04), 0, 1) * 100)}%,${ringShade(color, N - 1, N)})`;
  const lapN = oMax > 0 ? Math.min(M, Math.ceil(oMax * M) + Math.ceil(cap / (2 * Math.PI) * M) + 2) : 0;
  let lapSegs = memo.lap.get(lapN);
  if (lapSegs === undefined) { lapSegs = Array.from({ length: lapN }, (_, j) => lapN - 1 - j).map(j => seg(j / M * 2 * Math.PI - (j ? 0.004 : cap), (j + 1) / M * 2 * Math.PI, lapC(j))).join(''); memo.lap.set(lapN, lapSegs); if (memo.lap.size > 40) memo.lap.delete(memo.lap.keys().next().value); }
  // The shadow under a round end: soft (blurred) and just in front of it, so the end seems to lie on the ring, like the
  // rings on a watch.
  const soft = `<circle cx="${h + r}" cy="${h + stroke * 0.3}" r="${stroke / 2}" fill="rgb(0 0 0/.42)" filter="url(#${id}b)"/>`;
  const arc = part => `<circle data-sw="${part}" cx="${h}" cy="${h}" r="${r}" fill="none" stroke="#fff" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" style="opacity:0"/>`;
  return `<g class="sweep" data-sweep="${key || ''}" data-f0="${F0}" data-f1="${F}" data-c="${c}" data-color="${esc(color)}">
    <filter id="${id}b" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="${(stroke * 0.16).toFixed(1)}"/></filter>
    <mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}">${arc('base')}</mask>
    <g mask="url(#${id})">${full}<g data-sw="cap">${startCap}</g>
      <g class="ringhead" data-sw="head" style="opacity:0"><g data-sw="hshadow">${soft}</g><circle data-sw="hdot" cx="${h + r}" cy="${h}" r="${stroke / 2}"/></g></g>
    ${lap ? `<g mask="url(#${id})"><g class="ringhead" data-sw="lshadow" style="opacity:0">${soft}</g></g>
    <mask id="${id}o" maskUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}">${arc('lap')}</mask><g mask="url(#${id}o)">${lapSegs}</g>` : ''}
  </g>`;
}
/* Put a sweep ring at p (0 = empty, 1 = the goal, 2 = twice the goal). */
function sweepSet(g, p){
  const c = +g.dataset.c, N = 72, part = n => g.querySelector(`[data-sw="${n}"]`), show = (el, on) => { if (el) el.style.opacity = on ? '1' : '0'; };
  const b = clamp(p, 0, 1), o = clamp(p - 1, 0, 1);
  const base = part('base'); base.style.strokeDashoffset = c * (1 - b); show(base, b > 0.001);
  const head = part('head'); head.style.transform = `rotate(${(b * 360).toFixed(2)}deg)`; show(head, b > 0.001 && o <= 0);
  part('hdot').style.fill = ringShade(g.dataset.color, Math.min(N - 1, Math.floor(b * N)), N);
  show(part('hshadow'), b >= 0.85); show(part('cap'), o <= 0);
  const lap = part('lap'); if (lap) { lap.style.strokeDashoffset = c * (1 - o); show(lap, o > 0.0005); }
  const ls = part('lshadow'); if (ls) { ls.style.transform = `rotate(${(o * 360).toFixed(2)}deg)`; show(ls, o > 0.0005); }
}
/* One smooth motion from where the ring was to where it goes: through the top and on, with one easing for the whole way
   (it only slows down at the very end). A longer way takes a little longer. */
function sweepRings(){
  document.querySelectorAll('g[data-sweep]').forEach(g => {
    const key = g.dataset.sweep, f0 = +g.dataset.f0, f1 = +g.dataset.f1;
    g.removeAttribute('data-sweep');
    if (f0 === f1 || reduceMotion()) { sweepSet(g, f1); return; }
    sweepSet(g, f0);
    const dur = 800 + 400 * Math.min(1, Math.abs(f1 - f0)), t0 = performance.now(), ease = t => 1 - Math.pow(1 - t, 3);
    const step = now => {
      if (!g.isConnected) return;
      const t = Math.min(1, (now - t0) / dur), p = f0 + (f1 - f0) * ease(t);
      sweepSet(g, p);
      if (key) { if (t < 1) sweepLive[key] = p; else delete sweepLive[key]; }
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
/* Protein, carbs and fat as three small rings. The fat ring runs up to the maximum, with a tick at the minimum and
   the saturated part in a darker shade. Over the goal (fat over its maximum) the number turns orange. */
function minisHTML(t, M, k){
  const r = (56 - 7) / 2, c = 2 * Math.PI * r;
  const satArc = t.sf > 0 ? `<circle cx="28" cy="28" r="${r}" fill="none" stroke="var(--fsat)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(c * clamp(t.sf / M.fMax, 0, 1)).toFixed(1)} ${c.toFixed(1)}"/>` : '';
  const over = (v, g) => v > g * 1.1 ? ' style="color:var(--warn-ink)"' : '';
  // Each ring is its own button: it opens what that macro came from today, most first.
  const mini = (l, v, g, col, sub, aria, extra = '', mark, m) =>
    `<button class="mini" data-act="macro-src" data-m="${m}" aria-label="${aria}, tik voor waar het in zat"><div class="mring">${ringSVG(v / g, col, 56, 7, 'm' + l + k, mark).replace(/(<line[^>]*\/>)?<\/svg>$/, m => extra + m)}<span class="num"${over(v, g)}>${r0(v)}</span></div><span class="ml">${l}</span><span class="note num">${sub}</span></button>`;
  const satLine = t.f >= 1 || t.sfUnknown ? `<button class="satline" data-act="explain-macros" aria-label="Verzadigd vet ${r0(t.sf)} van hooguit ${M.sfMax} gram, uitleg">
      <span class="sw" aria-hidden="true"></span><span class="st"><span>Verzadigd vet <b class="num"${t.sf > M.sfMax ? ' style="color:var(--warn-ink)"' : ''}>${r0(t.sf)}</b> <span class="num">/ max ${M.sfMax} g</span></span>${t.sfUnknown ? `<span class="note">${t.sfUnknown} ${t.sfUnknown === 1 ? 'maaltijd' : 'maaltijden'} zonder deze gegevens</span>` : ''}</span><i aria-hidden="true">i</i></button>` : '';
  return `<div class="minis" role="group" aria-label="Eiwit, koolhydraten en vet">
      ${mini('Eiwit', t.p, M.p, 'var(--p)', `van ${M.p} g`, `Eiwit ${r0(t.p)} van ${M.p} gram`, '', undefined, 'p')}
      ${mini('Koolh.', t.c, M.c, 'var(--c)', `van ${M.c} g`, `Koolhydraten ${r0(t.c)} van ${M.c} gram`, '', undefined, 'c')}
      ${mini('Vet', t.f, M.fMax, 'var(--f)', `${M.fMin}–${M.fMax} g`, `Vet ${r0(t.f)} gram, goed is tussen ${M.fMin} en ${M.fMax} gram`, '', M.fMin / M.fMax, 'f')}
      ${mini('Verz. vet', t.sf, M.sfMax, t.sf > M.sfMax ? 'var(--warn)' : 'var(--fsat)', `max ${M.sfMax} g`, `Verzadigd vet ${r0(t.sf)} van hooguit ${M.sfMax} gram${t.sfUnknown ? `, ${t.sfUnknown} maaltijden zonder deze gegevens` : ''}`, '', undefined, 'sf')}
    </div>`;
}
/* Where a macro of a day came from: every product you ate, the most first, with a bar, its grams and its share of the
   day. The same product in two meals counts as one line ("2×"). The first 8 show; the rest folds open. A meal without
   item details counts as one line; saturated fat the app doesn't know is listed at the bottom. */
const MACRO_INFO = { p: ['Eiwit', 'var(--p)'], c: ['Koolhydraten', 'var(--c)'], f: ['Vet', 'var(--f)'], sf: ['Verzadigd vet', 'var(--fsat)'] };
function macroSourcesHTML(k, m){
  const rows = new Map(), unknown = [];
  day(k).entries.filter(e => !e.pending).forEach(e => {
    const mult = e.mult || 1, its = e.items && e.items.length ? e.items : [{ name: e.name, p: e.p, c: e.c, f: e.f, sf: e.sf }];
    // The meal's own total wins when its items don't add up to it (an older entry, or changed by hand).
    const sum = its.reduce((a, i) => a + (num(i[m]) * mult), 0), fix = e.items && e.items.length && m !== 'sf' && sum > 0 && Math.abs(sum - num(e[m])) > 1 ? num(e[m]) / sum : 1;
    its.forEach(i => {
      if (m === 'sf' && i.sf == null) { if (num(i.f) * mult >= 1) unknown.push(i.name); return; }
      const v = num(i[m]) * mult * fix; if (v < 0.05) return;
      const key = foldText(i.name).trim(), r = rows.get(key) || { name: i.name, v: 0, n: 0, meals: new Set() };
      r.v += v; r.n++; r.meals.add(e.meal); rows.set(key, r);
    });
  });
  const list = [...rows.values()].sort((a, b) => b.v - a.v), tot = list.reduce((a, r) => a + r.v, 0);
  if (!list.length) return `<p class="muted">${unknown.length ? `Van wat je ${k === todayKey() ? 'vandaag' : 'die dag'} at weet Knabbel het verzadigd vet niet (${esc(unknown.slice(0, 3).join(', '))}${unknown.length > 3 ? ` en nog ${unknown.length - 3}` : ''}): eerder gelogd, of zelf ingevuld zonder.`
    : `${k === todayKey() ? 'Vandaag' : 'Die dag'} zat er nog geen ${MACRO_INFO[m][0].toLowerCase()} in wat je at.`}</p>`;
  const g = v => (v >= 10 ? r0(v) : v.toFixed(1).replace('.', ',')) + ' g', max = list[0].v;
  const row = r => `<div class="ss-row"><span class="ss-n"><b>${esc(r.name)}</b><span class="note">${r.n > 1 ? `${r.n}× · ` : ''}${[...r.meals].map(x => MEAL_NAME(x)).join(', ')} · ${r0(r.v / tot * 100)}%</span></span><span class="ss-bar" aria-hidden="true"><i style="width:${r0(r.v / max * 100)}%;background:${MACRO_INFO[m][1]}"></i></span><b class="num ss-g">${g(r.v)}</b></div>`;
  const M = macroGoals(k), goal = m === 'p' ? `van ${M.p} g` : m === 'c' ? `van ${M.c} g` : m === 'f' ? `goed is ${M.fMin}–${M.fMax} g` : `van hooguit ${M.sfMax} g`;
  return `<div class="satsrc"><span class="eyebrow">Waar zat je ${MACRO_INFO[m][0].toLowerCase()} in?</span>
    ${list.slice(0, 8).map(row).join('')}
    ${list.length > 8 ? `<details class="more-rows"><summary>Nog ${list.length - 8} ${list.length - 8 === 1 ? 'product' : 'producten'} ›</summary><div>${list.slice(8).map(row).join('')}</div></details>` : ''}
    ${unknown.length ? `<div class="ss-row"><span class="ss-n"><b>${esc(unknown.slice(0, 3).join(', '))}${unknown.length > 3 ? ` en nog ${unknown.length - 3}` : ''}</b></span><span class="note">onbekend</span></div>` : ''}
    <p class="note num">Samen ${g(tot)} ${k === todayKey() ? 'vandaag' : 'die dag'} (${goal}).</p></div>`;
}
/* The sheet behind the rings: a switch between the four, the list for the chosen one, the explanation underneath. */
let macroSlide = 0;   // -1 or 1 right after a swipe: the new list slides in from that side
/* After +250 (or another amount): a small "+250 ml" rises from the button, the number on the tile counts up and
   lights up, and a message says the new total with "Ongedaan maken". Before, only the number changed, so you had to
   remember the old one to see whether it worked. */
function waterFeedback(rect, delta, from){
  const k = dayKey, to = fluidMl(k), goal = waterGoal(k), sign = delta > 0 ? '+' : '−', fmt = n => n.toLocaleString('nl-NL');
  if (!reduceMotion()) {
    if (rect) { const f = document.createElement('div'); f.className = 'wfloat num'; f.textContent = `${sign}${Math.abs(delta)} ml`;
      f.style.left = `${rect.left + rect.width / 2}px`; f.style.top = `${rect.top}px`; document.body.appendChild(f);
      f.animate([{ transform: 'translate(-50%,0)', opacity: 1 }, { transform: 'translate(-50%,-42px)', opacity: 0 }], { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)' }).onfinish = () => f.remove(); }
    const count = (el, a, b) => { const t0 = performance.now(), step = now => { if (!el.isConnected) return; const p = Math.min(1, (now - t0) / 500), e = 1 - (1 - p) ** 3;
      el.textContent = Math.round(a + (b - a) * e); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); };
    document.querySelectorAll('.wnum').forEach(el => count(el, from, to));
    document.querySelectorAll('.wover').forEach(el => count(el, Math.max(0, from - goal), to - goal));
    document.querySelectorAll('.tile[data-tile="water"], .wextra').forEach(el => { el.classList.remove('wbump'); void el.offsetWidth; el.classList.add('wbump'); });
  }
  toast(`${sign}${Math.abs(delta)} ml · ${fmt(to)} / ${fmt(goal)} ml${to > goal ? ` (${fmt(to - goal)} extra)` : ''}`,
    { label: 'Ongedaan maken', fn: () => { const dd = ensureDay(k); dd.water = Math.max(0, (dd.water || 0) - delta); save(); render(); } });
}
function macroSheet(k, m){
  sheet('Waar zat het in?', `<div class="seg" role="group" aria-label="Macro">${Object.entries(MACRO_INFO).map(([x, [l]]) => `<button data-act="macro-src" data-m="${x}" aria-pressed="${x === m}">${x === 'c' ? 'Koolh.' : x === 'sf' ? 'Verz. vet' : l}</button>`).join('')}</div>
    <div class="msrc" data-swipe-m="${m}">${macroSourcesHTML(k, m)}</div>
    <details class="more-rows"><summary>Uitleg over je doelen ›</summary><div>${macroExplainBody(k)}</div></details>
    <button class="btn block" data-act="close">Oké</button>`, sheetOpen());
  const box = macroSlide && !reduceMotion() && document.querySelector('.msrc');
  if (box) box.animate([{ transform: `translateX(${macroSlide * 48}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' });
  macroSlide = 0;
}
/* Swipe left or right over the list: the next or previous macro (Eiwit → Koolh. → Vet → Verz. vet). Only a clearly
   sideways swipe counts, so scrolling and swiping the sheet down still work. */
let mSwipe = null;
document.addEventListener('touchstart', e => { const box = e.target.closest && e.target.closest('.msrc'); mSwipe = box ? { m: box.dataset.swipeM, x: e.touches[0].clientX, y: e.touches[0].clientY } : null; }, { passive: true });
document.addEventListener('touchend', e => {
  const s = mSwipe; mSwipe = null; if (!s) return;
  const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  const keys = Object.keys(MACRO_INFO), i = keys.indexOf(s.m), j = i + (dx < 0 ? 1 : -1);
  if (j < 0 || j >= keys.length) return;
  macroSlide = dx < 0 ? 1 : -1; macroSheet(dayKey, keys[j]);
}, { passive: true });
/* How the macro goals work, with today's numbers. Used in the goal sheet and behind the saturated-fat line. */
function macroExplainBody(k){
  const M = macroGoals(k), t = totals(k), kcal = budget(k).kcal;
  return `<p><b>Eiwit ${M.p} g</b>: houdt je spieren sterk en geeft een vol gevoel. Dit hangt af van je gewicht en lengte, niet van wat je eet. Verdeel het liefst over de dag: 25 tot 40 g per maaltijd werkt beter dan alles in één keer.</p>
      <p><b>Vet ${M.fMin} tot ${M.fMax} g</b>: 20 tot 35% van je ${kcal} kcal. Nodig voor je hormonen en vitamines. Het streepje in het vetringetje is het minimum; het ringetje is vol bij het maximum.</p>
      <p><b>Verzadigd vet hooguit ${M.sfMax} g</b> (10%): het donkere stuk in het vetringetje. Dat zit vooral in boter, kaas, vlees, koek en snacks. Vet uit noten, olijfolie en vette vis is onverzadigd en juist gezond.</p>
      <p><b>Koolhydraten ${M.c} g</b>: de rest van je calorieën. Eet je meer vet (tot het maximum) of meer eiwit dan je doel, dan schuift dit omlaag, zodat alles samen op je eetdoel uitkomt. Met weinig vet mag het tot ${M.cMax} g.</p>
      ${t.sfUnknown ? `<p class="note">Van ${t.sfUnknown} ${t.sfUnknown === 1 ? 'maaltijd' : 'maaltijden'} weet Knabbel het verzadigd vet niet (eerder gelogd, of zelf ingevuld zonder). Die tellen niet mee in het donkere stuk.</p>` : ''}`;
}
/* A dot on the ring: where you would roughly be at this time of day. */
function nowDot(frac){
  // Always shown on today: before breakfast it sits at the start (0), late in the evening at the goal (just before
  // the top, so it doesn't vanish under the start of the ring). It used to disappear at exactly 0 and 1.
  if (!(frac >= 0)) return '';
  const f = clamp(frac, 0, 0.985);
  const size = 210, r = (size - 15) / 2, h = size / 2, a = f * 2 * Math.PI;
  return `<circle cx="${(h + r * Math.cos(a)).toFixed(1)}" cy="${(h + r * Math.sin(a)).toFixed(1)}" r="5.5" fill="var(--ink)" stroke="var(--surface)" stroke-width="2.5"/>`;
}
/* Small praise per meal, worked out from the grams of protein, carbs and fat saved with the meal
   (fat 9 kcal/g, protein and carbs 4 kcal/g). Protein and fat badges only when those grams add up to
   roughly the kcal, so a meal with only kcal filled in (fat 0 g) never counts as low-fat. */
const macrosFit = e => { const m = (e.p || 0) * 4 + (e.c || 0) * 4 + (e.f || 0) * 9; return e.kcal > 0 && m >= e.kcal * 0.7 && m <= e.kcal * 1.3; };
const NBADGES = [
  ['eiwit', '💪 Eiwitrijk', 'Veel eiwit: dat houdt je langer vol en beschermt je spieren.', e => macrosFit(e) && e.p >= 15 && e.p * 4 >= e.kcal * 0.25],
  ['licht', '🪶 Licht', 'Weinig calorieën per hap (onder 1,5 kcal per gram): het vult goed voor weinig calorieën.', e => {
    // Only when the grams are known: without them a handful of nuts would count as "light" too.
    const d = densityOf(e); return d != null && d !== 'drink' && e.kcal >= 30 && d <= 1.5; }],
  ['vetarm', '💧 Vetarm', 'Minder dan 20% van de calorieën komt uit vet.', e => macrosFit(e) && e.kcal >= 100 && e.f * 9 <= e.kcal * 0.2],
  ['voedzaam', '🥦 Voedzaam', 'Veel voedingsstoffen voor de calorieën die erin zitten.', e => (e.score || 0) >= 8]
];
/* Energy density: kcal per gram. Under 1.5 fills you up for few kcal (soup, vegetables, quark, fruit); above 4 is
   dense (crisps, nuts, chocolate). Only for food you weighed or that has grams; drinks are left out. */
function densityOf(e){
  const its = e.items || [], m = e.mult || 1;
  // Soup counts as food here: it is the classic example of filling food with few kcal.
  const g = its.reduce((a, i) => a + (i.grams || 0), 0) * m, ml = its.reduce((a, i) => a + (/soep/i.test(i.name) ? 0 : itemMl(i)), 0) * m;
  if (g < 50) return null;
  if (ml >= g * 0.5) return 'drink';
  return e.kcal / g;
}
const nbadgesOf = e => e && !e.pending ? NBADGES.filter(b => b[3](e)) : [];
/* Text on a tinted pill: mixed with the ink colour so it stays readable in light and dark mode. */
const pillStyle = col => `background:color-mix(in srgb,${col} 18%,transparent);color:color-mix(in srgb,${col} 62%,var(--ink))`;
function scoreStyle(s){ return pillStyle(s >= 7 ? 'var(--leaf)' : s >= 4 ? 'var(--warn)' : 'var(--bad)'); }
const CHEV = '<svg class="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
/* Today is made of blocks you can reorder and fold. A folded block shows how much is in it. */
const BLOCKS = [['ring', 'Knabbel & calorieën'], ['ontbijt', 'Maaltijden'], ['water', 'Vocht, beweging & vasten']];
const DEFAULT_SHUT = { fast: true };
function layout(){
  const L0 = S.meta.layout || {}, known = BLOCKS.map(b => b[0]);
  const order = (L0.order || []).filter(id => known.includes(id));
  known.forEach(id => { if (!order.includes(id)) order.push(id); });
  return { order, shut: Object.assign({}, DEFAULT_SHUT, L0.shut || {}) };
}
function block(id, title, sum, body, opts = {}){
  // The Knabbel block always stays open: it is the heart of the page.
  if (opts.fixed) return `<section class="card blk" aria-label="${esc(title.replace(/<[^>]*>/g, '').trim())}" ${opts.style ? `style="${opts.style}"` : ''}>
    <div class="blk-h"><h3>${title}</h3>${opts.sumShut ? '' : `<span class="bsum num">${sum}</span>`}</div>
    ${body}</section>`;
  const shut = layout().shut[id];
  return `<section class="card blk${shut ? ' shut' : ''}" aria-label="${esc(title.replace(/<[^>]*>/g, '').trim())}" ${opts.style ? `style="${opts.style}"` : ''}>
    <button class="blk-h" data-collapse="${id}" aria-expanded="${!shut}"><h3>${title}</h3>${opts.cnt != null && shut ? `<span class="cnt num">${opts.cnt}</span>` : ''}${opts.sumShut && !shut ? '' : `<span class="bsum num">${sum}</span>`}<svg class="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    ${shut ? '' : body}</section>`;
}
function todayHTML(){
  const T = S.profile.targets, t = totals(dayKey), d = day(dayKey), B = budget(dayKey), M = macroGoals(dayKey), left = B.kcal - t.kcal;
  const isToday = dayKey === todayKey(), mood = isToday ? petMood() : null, over = left < 0;
  const wGoal = waterGoal(dayKey), cups = Math.ceil(wGoal / 250), drank = drinksMl(dayKey), fluid = (d.water || 0) + drank;
  const due = isToday && dueWeek(), DS = dayScore(dayKey);
  const mv = d.move;
  const parts = {};
  /* Knabbel lives in the calorie ring: his mood follows what you ate. Other days show the plain ring. */
  const macrosHTML = `
      ${isToday ? '' : `<button class="goal-row" data-act="explain-goal" aria-label="Uitleg over je eetdoel"><span class="eyebrow">Gegeten</span><span class="num">${r0(t.kcal)} / ${B.kcal} kcal <i aria-hidden="true">i</i></span></button>`}
      ${t.kcal < minKcal() && (!isToday || new Date().getHours() >= 18) && t.kcal > 0 ? `<p class="note num" style="text-align:center"><b style="color:var(--warn-ink)">Nog ${minKcal() - r0(t.kcal)} kcal tot je minimum van ${minKcal()}</b></p>` : ''}
      ${hasPending(dayKey) ? `<p class="note">⏳ ${d.entries.filter(e => e.pending).length === 1 ? '1 maaltijd telt' : d.entries.filter(e => e.pending).length + ' maaltijden tellen'} nog niet mee</p>` : ''}
      ${minisHTML(t, M, dayKey)}`;
  const partialHTML = d.entries.length && (!isToday || new Date().getHours() >= 18) ? `<button class="check compact" data-act="toggle-partial" aria-pressed="${isPartial(dayKey)}"><span class="box" aria-hidden="true">${isPartial(dayKey) ? '✓' : ''}</span><span class="grow">Niet alles gelogd ${isToday ? 'vandaag' : 'deze dag'} <span class="note">· telt dan niet mee in je gemiddelde</span></span></button>` : '';
  const H = isToday ? hunger() : null;
  const stk = isToday ? streak() : 0;
  parts.ring = block('ring', isToday ? `${esc(S.meta.pet.name)}${stk ? ` <span class="streakpill num" aria-label="${stk} ${stk === 1 ? 'dag' : 'dagen'} op rij gelogd, ${flameTier(stk)[1].toLowerCase()}">${flameSVG(stk)} ${stk}</span>` : ''}` : 'Calorieën', `${H ? H.emoji + ' ' : ''}${r0(t.kcal)} / ${B.kcal} kcal`, isToday ? `
    <p class="bubble talk" id="petBubble">${esc(petLine(mood))}</p>
    <div class="ringpet">
      <div class="ring big" style="--glow:${t.kcal > B.kcal * 1.1 ? 'var(--warn)' : t.kcal / B.kcal >= 0.9 ? 'var(--leaf)' : 'var(--accent)'}">${ringSVG(t.kcal / B.kcal, 'var(--accent)', 210, 15, 'kcal' + dayKey, minKcal() / B.kcal, true, true).replace('</svg>', nowDot(expectedByNow()) + '</svg>')}
        <button class="pet m-${mood}" data-alive data-act="pet-poke" aria-label="Aai ${esc(S.meta.pet.name)}">${petSVG(mood, S.meta.pet.wear)}</button></div>
      <button class="ringmode" data-act="ring-mode" aria-label="${S.meta.ringMode === 'eaten' ? 'Toon wat je nog mag eten' : 'Toon wat je hebt gegeten'}"><span aria-hidden="true">⇄</span> Toon ${S.meta.ringMode === 'eaten' ? 'nog te eten' : 'gegeten'}</button>
      <button class="ringnum" data-act="explain-goal" aria-label="Uitleg over je eetdoel">${S.meta.ringMode === 'eaten'
        ? `<span class="big num">${r0(t.kcal)}</span><span class="lbl">kcal gegeten</span>`
        : `<span class="big num">${r0(Math.abs(left))}</span><span class="lbl">${over ? 'kcal boven je doel' : 'kcal nog te eten'}</span>`}<span class="goalline num">Eetdoel ${B.kcal} kcal <i aria-hidden="true">i</i></span>${weekLineHTML()}</button>
    </div>
    <div class="macros">${macrosHTML}</div>
` : `
    <div class="hero">
    <div class="ring">${ringSVG(t.kcal / B.kcal, 'var(--accent)', 148, 14, 'kcal' + dayKey, minKcal() / B.kcal, true, true)}
      <div class="mid"><span class="big num">${r0(Math.abs(left))}</span><span class="lbl">${over ? 'kcal boven je doel' : 'kcal nog te eten'}</span></div></div>
    <div class="macros">${macrosHTML}</div></div>`, { sumShut: isToday, fixed: true });
  parts.ontbijt = `<section class="card meals" aria-label="Maaltijden">${mealSections(d, isToday).map(([id, label, pick]) => {
    const list = d.entries.map((e, i) => [e, i]).filter(([e]) => pick(e)).sort((a, b) => (a[0].t || 0) - (b[0].t || 0) || a[1] - b[1]).map(([e]) => e), sum = list.reduce((a, e) => a + e.kcal, 0);
    return `<div class="mealsec" data-m="${id}" style="--mc:var(--m-${id},var(--accent))"><div class="meal-h"><h3>${FL('icons') ? flIcon(id) : ''}${label}</h3>${list.length ? `<span class="bsum num">${r0(sum)} kcal</span>` : ''}<button class="add-line" data-act="open-log" data-meal="${id}" aria-label="${label}: toevoegen">+ Toevoegen</button></div>
      ${list.map(e => `<button class="entry${e.pending ? ' pending' : ''}${e.id === flashId ? ' flash' : ''}" data-edit="${e.id}">
          <span class="thumb" aria-hidden="true">${e.pending ? '⏳' : foodIcon(e)}</span>
          <span class="grow"><span class="name">${esc(e.name)}</span><span class="sub num">${e.pending ? 'Wordt uitgerekend zodra het weer lukt' : [entryClock(e), nbadgesOf(e)[0] && nbadgesOf(e)[0][1]].filter(Boolean).join(' · ')}</span></span>
          <span class="kc">${e.pending ? '…' : `<span>${r0(e.kcal)} <span class="note">kcal</span></span>`}</span><span class="chev" aria-hidden="true">›</span></button>`).join('')}</div>`; }).join('')}
    ${d.entries.some(e => !e.pending) ? `<div class="mealtotal"><span>${isToday ? 'Totaal gegeten vandaag' : 'Totaal gegeten'}</span><b class="num">${r0(t.kcal).toLocaleString('nl-NL')} kcal</b></div>` : ''}
    ${DS || partialHTML ? `<div class="mealfoot">${DS ? `<button class="dayscore" data-act="explain-dayscore" aria-label="Dagscore ${DS.score} van 10, uitleg"><span>Dagscore voedzaamheid <i class="info-i" aria-hidden="true">i</i></span><span class="score" style="${scoreStyle(DS.score)}">${DS.score}/10</span></button>` : ''}${partialHTML}</div>` : ''}</section>`;
  /* 1b. Water, movement and fasting are small tiles; tap one to open it. */
  const tiles = [], tile = (id, icon, title, sum, body) => { tiles.push({ id, icon, title, sum, body }); return ''; };
  // Above the goal the glasses are all full, so one bonus glass at the end of the row (the same glass, in a fresh
  // blue-green with a plus) shows what came on top, with "+250" under it: it counts up and pops with every glass,
  // without adding more glasses (with a high goal there are already many).
  parts.water = tile('water', '💧', 'Vocht', `<span class="wnum">${fluid}</span> / ${wGoal} ml`, `
    <div class="cups" role="img" aria-label="${fluid} van ${wGoal} ml">${Array.from({ length: cups }, (_, i) => { const h = r0(clamp((fluid - i * 250) / 250, 0, 1) * 100);
      return `<span class="cup${h >= 100 ? ' full' : ''}"><i style="height:${motionFrom('cup' + i + dayKey, h, 0)}%" data-h="${h}%"></i></span>`; }).join('')}${fluid > wGoal ? `<span class="wextra" aria-label="${fluid - wGoal} ml boven je doel"><span class="cup full bonus"><i style="height:100%"></i></span><small class="num">+<span class="wover">${fluid - wGoal}</span> ml</small></span>` : ''}</div>
    <details class="infox"><summary><i aria-hidden="true">i</i>Hoe is dit berekend?</summary>${drank ? `<p class="note num">${d.water || 0} ml water + ${drank} ml uit wat je dronk (koffie, thee, melk…)</p>` : ''}<p class="note num">Doel ${wGoal} ml: ${waterWhy(dayKey)}</p></details>
    <div class="water-btns">
      <button class="btn small ghost" data-water="-250" aria-label="250 ml eraf">−250 ml</button>
      <button class="btn small" data-water="250">+250 ml</button>
      <button class="btn small ghost" data-water="500">+500 ml</button>
    </div>
    <div class="waterin"><label>Anders<input id="waterMl" type="text" inputmode="numeric" autocomplete="off" placeholder="bijv. 330" aria-label="Andere hoeveelheid in ml" enterkeyhint="done">ml</label><button class="btn small ghost" data-act="water-add">Toevoegen</button></div>`);
  // On the iPhone the Beweging tile is always there (between Vocht and Vasten, where Health Connect's is on Android), with
  // a paste button on it; before Apple Health is set up it says how.
  const applePlace = !Native && isIOS() && isToday;
  if (!moveOn() && applePlace) tile('move', '🏃', 'Beweging', 'Plak je stappen', `
    <p class="note" style="margin-top:-6px">Je stappen en actieve kcal uit Apple Gezondheid tellen mee voor je eetdoel van vandaag. Draai je Opdracht <b>Knabbel</b> en tik op Plak.</p>
    <button class="btn small" data-act="apple-paste" style="align-self:flex-start">❤️ Plak uit Apple Health</button>
    <button class="add-line" data-nav="settings">Opdracht instellen (eenmalig, 5 minuten)</button>`);
  if (moveOn()) tile('move', '🏃', 'Beweging', `${r0(moveKcal(dayKey))} kcal`, `
    <p class="note" style="margin-top:-6px">${S.meta.health.on ? (mv?.at ? 'Bron: Health Connect · ' + new Date(mv.at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : 'Bron: Health Connect') : appleOn() ? (mv?.src === 'apple' ? 'Bron: Apple Health · geplakt om ' + new Date(mv.at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : 'Bron: Apple Health · nog niet geplakt') : 'Bron: zelf ingevuld'}</p>
    ${appleOn() && isToday ? `<button class="btn small${mv?.src === 'apple' ? ' ghost' : ''}" data-act="apple-paste" style="align-self:flex-start">❤️ Plak uit Apple Health</button>` : ''}
    ${measuredMove() ? `<div class="movegrid"><div><b class="num">${(mv?.steps || 0).toLocaleString('nl-NL')}</b><span>stappen</span></div>
      <div><b class="num">${r0(moveKcal(dayKey))}</b><span>kcal verbrand</span></div>
      <div><b class="num">${(mv?.min || 0) + (d.workouts || []).reduce((a, w) => a + (w.min || 0), 0)}</b><span>min training</span></div></div>
    ${stepSrcHTML(mv)}
    ${(() => { const hm = hcMoveInfo(dayKey); return hm.how === 'gemiddeld' ? `<p class="note num">Gemeten ${r0(hm.watch)} kcal, schatting uit je stappen en sessies ${r0(hm.est)} kcal. Telefoons en horloges zitten er vaak naast, dus Knabbel telt het midden: ${r0(hm.kcal)} kcal.</p>` : ''; })()}
    ${mv?.sessions?.length ? `<div class="sessions">${mv.sessions.map(s => { const sk = sessionKcal(s);
      return `<div class="row between"><span class="grow">${esc(s.label)} · <span class="num">${s.min} min</span>${sk.watch != null ? `<span class="note num" style="display:block">gemeten ${r0(sk.watch)} · schatting ${r0(sk.est)}</span>` : ''}</span><b class="num">${r0(sk.kcal)} kcal</b></div>`; }).join('')}</div>` : ''}` : ''}
    ${worksHTML(d)}
    <p class="note">${moveWhy(dayKey)}</p>
    <button class="add-line" data-act="open-workout">+ Sport toevoegen</button>
    ${moveGoalHTML(dayKey)}
    ${healthStatus === 'no_permission' && isToday ? `<p class="err">Knabbel heeft geen toegang meer tot Health Connect. <button class="add-line" data-act="hc-connect">Opnieuw toestaan</button></p>`
      : healthMissing && isToday ? `<button class="add-line" data-act="hc-connect">Geef Knabbel toegang tot meer gegevens voor een betere schatting</button>` : ''}`, { cnt: (d.workouts || []).length + (mv?.sessions?.length || 0) || null });
  if (isToday && fastOn()) tile('fast', '⏱️', 'Vasten', fastSummary(), fastBodyHTML());
  const tl = tiles.find(x => x.id === openTile);
  parts.water = tiles.length ? `<section class="card" aria-label="Vocht, beweging en vasten"><div class="tiles" style="grid-template-columns:repeat(${tiles.length},1fr)">${tiles.map(x =>
    `<div class="tilewrap"><button class="tile" data-act="tile" data-tile="${x.id}" aria-expanded="${openTile === x.id}"><span class="ti" aria-hidden="true">${FL('icons') ? flIcon(x.id) : x.icon}</span><b>${x.title}</b><span class="note num">${x.sum}</span></button>${x.id === 'water' && isToday ? '<button class="tileadd" data-water="250" aria-label="250 ml drinken erbij">+250</button>' : ''}${x.id === 'move' && applePlace ? '<button class="tileadd apple" data-act="apple-paste" aria-label="Beweging plakken uit Apple Health">❤️ Plak</button>' : ''}</div>`).join('')}</div>
    ${tl ? `<div class="tilebody">${tl.body}</div>` : ''}</section>` : '';
  /* Only the most important notice shows; the next one comes when this one is done or put away. */
  const notices = isToday ? [
    dayDoneHTML(dayKey),
    safetyCardsHTML(),
    due ? `<section class="card weighcard">
    <h3>Weegmoment week ${due}</h3>
    <p class="muted">Een week verder! Weeg jezelf en kijk of je op schema ligt.</p>
    <button class="btn small" data-act="open-checkin" style="align-self:flex-start">Gewicht invullen</button></section>` : '',
    webNew ? `<section class="card" aria-label="Nieuwe versie"><h3>Nieuwe versie van Knabbel</h3>
    <p class="muted">Er staat een nieuwere versie klaar. Je gegevens blijven gewoon staan.</p>
    <button class="btn small" data-act="web-update" style="align-self:flex-start">Nu verversen</button></section>` : '',
    updateReady() && !(S.meta.updLaterUntil > Date.now()) ? `<section class="card" aria-label="Nieuwe versie">
    <div class="row between"><h3>Nieuwe versie van Knabbel</h3><button class="icon-btn" data-act="update-later" aria-label="Later" style="background:var(--surface2)">×</button></div>
    <p class="muted">${S.meta.update.notes ? esc(S.meta.update.notes) : 'Er staat een nieuwe versie voor je klaar.'} Je gegevens blijven gewoon staan.</p>
    <button class="btn small" data-act="update-install" style="align-self:flex-start" ${updBusy ? 'disabled' : ''}>${updBusy ? updLabel() : 'Nu bijwerken'}</button></section>` : '',
    !S.meta.ai.key ? `<section class="card"><div class="row between"><h3>Zet de gratis AI aan</h3><span class="pill warn">1 minuut</span></div>
    <p class="muted">Dan typ je gewoon "2 boterhammen met kaas" en rekent Knabbel de calorieën uit.</p>
    <button class="btn small ghost" data-act="goto-ai" style="align-self:flex-start">Instellen</button></section>` : '',
    backupDue() ? `<section class="card" aria-label="Back-up">
    <div class="row between"><h3>Tijd voor een back-up</h3><button class="icon-btn" data-act="backup-later" aria-label="Later" style="background:var(--surface2)">×</button></div>
    <p class="muted">${S.meta.lastBackup ? `Je laatste back-up is van ${shortDate(S.meta.lastBackup)}.` : 'Je hebt nog geen back-up.'} Zo raak je je gegevens nooit kwijt.</p>
    <button class="btn small ghost" data-act="backup-save" style="align-self:flex-start">Nu opslaan</button></section>` : ''
  ].filter(Boolean) : [];
  parts.ring += notices[0] || '';
  return `
  <div class="top">
    <div class="datebar">
      <button class="icon-btn" data-day="-1" aria-label="Vorige dag" ${dayKey <= minDay() ? 'disabled' : ''}><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <span class="d">${prettyDay(dayKey)}</span>
      <button class="icon-btn" data-day="1" aria-label="Volgende dag" ${isToday ? 'disabled' : ''}><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    </div>
    <div class="row"><button class="seedpill num" data-act="seed-history" aria-label="${S.meta.pet.seeds} zaadjes, geschiedenis">🌻 ${S.meta.pet.seeds}<span class="sp-w"> zaadjes</span></button>
      <button class="icon-btn" data-nav="settings" aria-label="Instellingen">${ICON.gear}</button></div>
  </div>



  ${layout().order.map(id => parts[id] || '').join('\n')}
`;
}
let openTile = null;
/* 5. Fasting only shows up once you switch it on (or a fast is running). */
const fastOn = () => S.meta.fastOn != null ? !!(S.meta.fastOn || S.meta.fast.start) : !!(S.meta.fast.start || S.meta.fast.log.length);
function fastSummary(){
  const F = S.meta.fast;
  if (!F.start) { const lastF = F.log.filter(x => x.h >= 0.1).pop(); return lastF ? `vorige keer ${kgStr(lastF.h)} uur` : 'niet bezig'; }
  const leftMs = F.start + F.goal * 3.6e6 - Date.now();
  return leftMs <= 0 ? 'klaar!' : `nog ${Math.floor(leftMs / 3.6e6)} u ${pad(Math.floor(leftMs / 6e4) % 60)} m`;
}
function fastBodyHTML(){
  const F = S.meta.fast;
  if (!F.start) {
    const lm = lastMealTime(), start = fastStartTs();
    return `<span class="eyebrow">Hoe lang?</span>
      <div class="fastplans">${FAST_PLANS.map(([h, l]) => `<button class="fastplan" data-fastgoal="${h}" aria-pressed="${F.goal === h && !fastCustom}"><b>${h} uur</b><span>${l}</span></button>`).join('')}</div>
      ${fastCustom || !FAST_PLANS.some(p => p[0] === F.goal) ? `<div class="fasthours">${FAST_HOURS.map(h => `<button class="chip" data-fastgoal="${h}" aria-pressed="${F.goal === h}">${h} uur</button>`).join('')}</div>`
        : `<button class="add-line" data-act="fast-custom">Zelf kiezen ${CHEV}</button>`}
      <span class="eyebrow">Vanaf</span>
      <div class="seg" role="group" aria-label="Starttijd">
        <button data-fastfrom="now" aria-pressed="${fastFrom === 'now'}">Nu</button>
        ${lm ? `<button data-fastfrom="last" aria-pressed="${fastFrom === 'last'}">Laatste hap ${hm(new Date(lm))}</button>` : ''}
        <button data-fastfrom="custom" aria-pressed="${fastFrom === 'custom'}">Andere tijd</button>
      </div>
      ${fastFrom === 'custom' ? `<label class="field">Gestopt met eten om<input id="fast-time" type="time" value="${esc(fastTime)}"></label>` : ''}
      <button class="btn block" data-act="fast-start">Start ${F.goal} uur vasten</button>
      <p class="note">Je mag weer eten om ${hm(new Date(start + F.goal * 3.6e6))}. Water, thee en zwarte koffie mogen altijd.</p>`;
  }
  const end = new Date(F.start + F.goal * 3.6e6), done = Date.now() >= end.getTime();
  return `<p class="note" style="margin-top:-6px">${F.goal} uur · sinds ${hm(new Date(F.start))}</p>
    <div class="row" style="gap:16px"><div class="fastring" data-fastring></div>
      <div class="grow" style="display:flex;flex-direction:column;gap:6px">
        <p data-fastmsg style="font-weight:700;font-size:15px"></p>
        <p class="note">${done ? 'Je mag weer eten.' : `Je mag weer eten om <b>${hm(end)}</b>${end.getDate() !== new Date().getDate() ? ' (morgen)' : ''}.`}</p>
        <button class="btn small ${done ? '' : 'ghost'}" data-act="fast-stop" style="align-self:flex-start">${done ? 'Afronden' : 'Stoppen'}</button>
      </div></div>`;
}
/* ---------- rearrange the Today page ---------- */
let LAYOUT = false;
function openLayout(){ L = null; C = null; W = null; LAYOUT = true; renderLayout(); }
function renderLayout(){
  const Lo = layout();
  sheet('Indeling van Vandaag', `
    <p class="muted">Zet de onderdelen in de volgorde die jij fijn vindt.</p>
    <div class="card" style="gap:0;padding-block:4px">${Lo.order.map((id, i) => { const name = (BLOCKS.find(b => b[0] === id) || [id, id])[1];
      return `<div class="lay"><span class="grow">${id === 'ring' ? esc(S.meta.pet.name) + ' & calorieën' : name}</span>
        <button class="icon-btn" data-lmove="${id}" data-dir="-1" aria-label="${name} omhoog" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon-btn" data-lmove="${id}" data-dir="1" aria-label="${name} omlaag" ${i === Lo.order.length - 1 ? 'disabled' : ''}>↓</button></div>`; }).join('')}</div>
    <button class="btn block ghost" data-act="layout-reset">Standaard herstellen</button>
    <button class="btn block" data-act="close">Klaar</button>`);
}

/* ---------- "Kan dit?": does what you fancy fit in what's left today? ---------- */
let FIT = { open: false, text: '', busy: false, error: '', res: null, token: 0 };
/* The verdict is worked out here from the same numbers as your ring and macro bars: kcal, and also fat and
   carbs (a little over is fine). Protein counts as a plus when you still need it. */
/* Main meals still to come today keep their room free. A meal counts as "still to come" when nothing is logged
   for it and its time hasn't started yet (lunch from 12:00, dinner from 17:00). The meal of right now is left out:
   what you ask about may be that meal. How much to keep: what you usually eat at that meal (3+ times in the last
   2 weeks), otherwise a share of your eat goal (breakfast 25%, lunch 30%, dinner 35%). */
const MEAL_START = { ontbijt: 0, lunch: 12, diner: 17 }, MEAL_SHARE = { ontbijt: 0.25, lunch: 0.30, diner: 0.35 };
function usualMealKcal(meal){
  const ks = Array.from({ length: 14 }, (_, i) => shiftKey(todayKey(), -i - 1));
  const sums = ks.map(k => day(k).entries.filter(e => e.meal === meal && !e.pending).reduce((a, e) => a + e.kcal, 0)).filter(v => v > 0);
  return sums.length >= 3 ? Math.round(sums.reduce((a, v) => a + v, 0) / sums.length / 10) * 10 : null;
}
const mealKcal = (k, m) => day(k).entries.filter(e => e.meal === m && !e.pending).reduce((a, e) => a + e.kcal, 0) + (day(k).entries.some(e => e.meal === m && e.pending) ? 200 : 0);
const mealDone = (k, m) => mealKcal(k, m) >= 200;
function mealReserve(withCurrent, skip){
  const k = todayKey(), n = new Date(), h = n.getHours() + n.getMinutes() / 60, cur = defaultMeal();
  const meals = ['ontbijt', 'lunch', 'diner'].filter(m => m !== skip && (withCurrent && m === cur || m !== cur && MEAL_START[m] > h) && !mealDone(k, m));
  const list = meals.map(m => ({ meal: m, kcal: usualMealKcal(m) ?? Math.round(budget(k).base * MEAL_SHARE[m] / 10) * 10 }));
  return { list, kcal: list.reduce((a, x) => a + x.kcal, 0), names: list.map(x => (MEALS.find(m => m[0] === x.meal) || [0, x.meal])[1].toLowerCase()) };
}
const andList = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' en ' + a[a.length - 1] : a[0] || '';
/* Is the question about a meal itself ("vanavond gourmetten", "wat neem ik als lunch")? Then that meal isn't kept
   free on top of it: it IS that meal. Recognised from the words; otherwise the AI tells which it is. */
function fitMealOf(text){
  const t = String(text || '').toLowerCase();
  if (/avondeten|avondmaal|\bdiner|gourmet|barbecue|\bbbq\b|uit eten|afhalen|bezorgen/.test(t)) return 'diner';
  if (/\blunch|tussen de middag|als middageten/.test(t)) return 'lunch';
  if (/ontbijt|vanochtend/.test(t)) return 'ontbijt';
  return null;
}
function fitVerdict(r){
  const k = todayKey(), t = totals(k), M = macroGoals(k), after = macroGoals(k, r), allLeft = budget(k).kcal - t.kcal;
  // Which meal is this? Said in words or by the AI; otherwise something meal-sized at meal time is taken as that meal.
  const cur = defaultMeal(), asMeal = r.meal || (cur !== 'snack' && !mealDone(k, cur) && r.kcal >= 350 ? cur : null);
  const Rv = mealReserve(true, asMeal), reserve = Math.min(Rv.kcal, Math.max(0, allLeft)), share = allLeft > 0 ? reserve / allLeft : 0;
  const left = allLeft - reserve;                                    // what is free now, after keeping room for later meals
  const lp = M.p - t.p, lc = (M.c - t.c) * (1 - share), lf = (M.fMax - t.f) * (1 - share);
  const tolF = Math.max(5, M.fMax * 0.1), tolC = Math.max(15, M.c * 0.15);
  const roomF = Math.max(0, lf) + tolF, roomC = Math.max(0, (after.c - t.c) * (1 - share)) + tolC;
  const overF = r.f > roomF, overC = r.c > roomC;
  const fracs = [r.kcal > 0 ? Math.max(0, left) / r.kcal : 1];
  if (r.f > 1) fracs.push(roomF / r.f);
  if (r.c > 1) fracs.push(roomC / r.c);
  const fit = Math.min(1, ...fracs), macrosOk = !overF && !overC;
  let v;
  if (r.kcal <= left && macrosOk) v = 'ja';
  else if (r.kcal <= left + 100 && macrosOk) v = 'net';
  else if (fit >= 0.25 && left >= 100) v = 'deels';
  else v = 'nee';
  return { v, meal: asMeal, left, allLeft, reserve, later: Rv.names, lp, lc, lf, overF, overC, overK: r.kcal > left + 100,
    frac: v === 'deels' ? Math.max(.25, Math.floor(fit * 4) / 4) : v === 'nee' ? 0 : 1,
    protein: r.p >= 12 && lp > 10 };
}
/* The week budget as an extra line under the day verdict, only when it changes something. It looks at kcal (saved kcal
   also make room for carbs and fat). Only kcal really saved on
   earlier days this week count (never borrowed from days still to come), so the rest of the week keeps its normal goal. */
function fitWeekHTML(r, V){
  const W = weekBudget(), overDay = r.kcal - V.left, fmt = v => r0(v).toLocaleString('nl-NL');
  if (V.v !== 'ja' && overDay > 0 && W.saved >= overDay)
    return `<div class="fitweek good"><span aria-hidden="true">📅</span><p><b>Past wel in je week.</b> Vandaag kom je hiermee ± ${fmt(overDay)} kcal boven je doel, maar je hebt deze week ${fmt(W.saved)} kcal gespaard. Daarna heb je nog ${fmt(W.saved - overDay)} over.${V.overF ? ' Let wel: er zit veel vet in.' : ''}</p></div>`;
  if (V.v !== 'ja' && overDay > 0 && W.saved >= 50)
    return `<div class="fitweek"><span aria-hidden="true">📅</span><p>Je hebt deze week ${fmt(W.saved)} kcal gespaard. Dat is niet genoeg voor de ± ${fmt(overDay)} kcal die je hiermee boven je doel komt.</p></div>`;
  if ((V.v === 'ja' || V.v === 'net') && W.saved <= -150)
    return `<div class="fitweek warn"><span aria-hidden="true">📅</span><p>Let op: je zit deze week al ${fmt(-W.saved)} kcal boven je weekbudget.</p></div>`;
  return '';
}
const FIT_LOOK = {
  ja: ['✅ Past prima', 'good', 'full'], net: ['👌 Past net', 'good', 'happy'],
  deels: ['🤏 Past als kleinere portie', 'warn', 'hungry'], nee: ['🙅 Past vandaag niet goed', 'bad', 'hungry']
};
const fracStr = f => ({ 0.25: '¼', 0.5: '½', 0.75: '¾' })[f] || fmtQty(f);
/* Why it does or doesn't fit, in words: the kcal as one sentence, then fat and carbs as a second one. */
function fitReasons(r, V){
  const kc = V.overK ? `${r0(r.kcal)} kcal, en je hebt nog ${r0(Math.max(0, V.left))} vrij${V.reserve ? ` als je ruimte houdt voor je ${andList(V.later)}` : ''}.` : '';
  const mac = [];
  if (V.overF) mac.push(`veel vet (${r0(r.f)} g, je hebt nog ${r0(Math.max(0, V.lf))} g over)`);
  if (V.overC) mac.push(`veel koolhydraten (${r0(r.c)} g, nog ${r0(Math.max(0, V.lc))} g over)`);
  if (!kc && !mac.length) return '';
  return kc ? kc + (mac.length ? ` Er zit ook ${andList(mac)} in.` : '') : `er zit ${andList(mac)} in.`;
}
function fitLocalText(r, V){
  const n = r.name.toLowerCase(), why = fitReasons(r, V), plus = V.protein ? ` Fijn: het helpt ook je eiwit (${r0(r.p)} g).` : '';
  const keep = V.reserve ? ` Je houdt dan nog genoeg over voor je ${andList(V.later)}.` : '';
  const enjoy = DRINK_RE.test(n) ? 'Proost!' : 'Eet smakelijk!';
  if (V.v === 'ja') return `Dat past! ${r.name} is ongeveer ${r0(r.kcal)} kcal en je hebt nog ${r0(V.left)} vrij.${keep}${plus} ${enjoy}`;
  if (V.allLeft <= 0 && r.kcal <= 120) return `Je zit vandaag al aan je doel. Heb je echt trek, dan is ${n} (± ${r0(r.kcal)} kcal) wel een van de lichtste keuzes. Water of thee kan ook.`;
  if (V.v === 'net') return `Dat past net: ${r0(r.kcal)} kcal, en je hebt nog ${r0(V.left)} vrij.${keep}${plus}`;
  if (V.v === 'deels') return `${r.name} is wat veel: ${why} ${r.grams > 0 ? `Ongeveer ${r0(r.grams * V.frac / 5) * 5} g past wel.` : `Een ${fracStr(V.frac)} portie past wel.`}${plus}`;
  return `Dat wordt vandaag lastig: ${why || `${r0(r.kcal)} kcal, en je hebt nog maar ${r0(Math.max(0, V.left))} over.`} Morgen weer een dag, of kies iets lichters.`;
}
/* Looking it up on the web after the answer is already on screen: a short question about only this product and
   portion (not the whole "Kan dit?" question again). Better numbers replace the estimate; the close NEVO product
   stays when the web value is far from it. */
async function fitLookup(text, approx, tok){
  const R = FIT.res, g = r0(R.grams);
  // First Open Food Facts (free): the package values of the product, for this many grams.
  if (g > 0) {
    const f = await offFind(R.name, R.kcal > 0 ? R.kcal / g * 100 : null).catch(() => null);
    if (!FIT.open || FIT.token !== tok || FIT.res !== R) return;
    if (f) {
      const it = { name: R.name, grams: g, qty: 1, base: {} }; offInto(it, f.h);
      if (Math.abs(it.kcal - R.kcal) > R.kcal * 0.1) { R.msg = ''; R.alt = ''; }
      Object.assign(R, { kcal: r0(it.kcal), p: r1(it.p), c: r1(it.c), f: r1(it.f), sf: it.sf != null ? r1(it.sf) : R.sf, nevoName: '', bron: 'Open Food Facts',
        sources: [{ title: `Open Food Facts: ${offName(f.h).slice(0, 40)}`, uri: `https://world.openfoodfacts.org/product/${encodeURIComponent(f.h.code || '')}` }] });
      cachePut(text, { title: R.name, items: [fitItem(R)], mult: 1, confidence: '', score: R.score, tip: '' }); save();
      FIT.looking = false; renderFit(); return;
    }
  }
  if (!canSearch()) { FIT.looking = false; renderFit(); return; }
  const prompt = `Zoek de voedingswaarden op van: ${R.name}${R.portion ? ` (${R.portion})` : ''}${g ? `, ${g} gram` : ''}. Kijk eerst bij het Voedingscentrum (voedingscentrum.nl); staat het daar niet, dan bij de fabrikant of supermarkt (ah.nl, jumbo.nl, lidl.nl), en anders bij een andere betrouwbare Nederlandse bron.
Geef de waarden voor ${g ? `die ${g} gram` : 'die portie'}, niet per 100 g.
Antwoord met alleen JSON: {"kcal":0,"eiwit":0,"koolhydraten":0,"vet":0,"verzadigd":0,"bron":"Voedingscentrum"}
Kun je het niet vinden: {"kcal":0}`;
  let j2 = null; try { j2 = await aiJSON(prompt, 30000, null, 0, null, true, 'opzoeken'); } catch (e) {}
  if (!FIT.open || FIT.token !== tok || FIT.res !== R) return;
  FIT.looking = false;
  const k2 = num(j2 && j2.kcal), pp = num(j2 && j2.eiwit), cc = num(j2 && j2.koolhydraten), ff = num(j2 && j2.vet), macro = 4 * pp + 4 * cc + 9 * ff;
  const sane = (!approx || (k2 >= R.kcal / 2 && k2 <= R.kcal * 2)) && (!macro || Math.abs(k2 - macro) / Math.max(k2, macro) <= 0.35);
  if (k2 > 0 && sane && Array.isArray(j2.__bronnen) && j2.__bronnen.length) {
    // The words from the first answer were about the estimate: far off, let the app say it with the new numbers.
    if (Math.abs(k2 - R.kcal) > R.kcal * 0.1) { R.msg = ''; R.alt = ''; }
    Object.assign(R, { kcal: r0(k2), p: r1(pp), c: r1(cc), f: r1(ff), sf: j2.verzadigd != null ? r1(num(j2.verzadigd)) : R.sf, nevoName: '', sources: j2.__bronnen,
      bron: webBron(j2.bron, j2.__bronnen) });
    cachePut(text, { title: R.name, items: [fitItem(R)], mult: 1, confidence: '', score: R.score, tip: '' }); save();
  }
  renderFit();
}
async function askFit(){
  const text = (($('#fitText') || {}).value || FIT.text || '').trim();
  if (!text) { toast('Typ eerst waar je zin in hebt.'); return; }
  L = null; C = null; W = null; LAYOUT = false; ASK = false;
  FIT = { open: true, text, busy: false, error: '', res: null, token: FIT.token + 1 };
  offPrefetch(text);   // searched while the AI thinks
  S.meta.fitAsks = (S.meta.fitAsks || 0) + 1; save();
  // Asked or logged before: answer straight away, without an AI request.
  const hit = cacheGet(text);
  if (hit) {
    const t = itemsTotals(hit.items, hit.mult || 1);
    FIT.res = { meal: fitMealOf(text), name: hit.title, portion: '', kcal: t.kcal, p: t.p, c: t.c, f: t.f, sf: t.sf, score: hit.score || null, grams: hit.items.reduce((a, i) => a + (i.grams || 0), 0) * (hit.mult || 1), msg: '', alt: '', cached: true };
    renderFit(); return;
  }
  const k = todayKey(), t = totals(k), B = budget(k), M = macroGoals(k), lp = Math.max(0, M.p - t.p), lc = Math.max(0, M.c - t.c), lf = Math.max(0, M.fMax - t.f), lsf = Math.max(0, M.sfMax - t.sf);
  const said = fitMealOf(text), RV = mealReserve(true, said);
  const keepTxt = (RV.kcal ? `\nLet op: de gebruiker moet vandaag nog ${andList(RV.names)} eten. Houd daar ongeveer ${RV.kcal} kcal voor vrij, dus vrij hiervoor is nu ${r0(Math.max(0, B.kcal - t.kcal - RV.kcal))} kcal. Beoordeel het daarop.` : '')
    + (said ? `\nDit is ${said === 'lunch' ? 'de' : 'het'} ${MEAL_NAME(said)} zelf: schat een hele maaltijd zoals je die normaal eet.` : RV.kcal ? '\nGaat de vraag zelf over een van die maaltijden (bijv. "vanavond gourmetten" is het avondeten), dan hoef je voor die maaltijd geen ruimte vrij te houden: die is dit.' : '');
  const now = new Date(), time = pad(now.getHours()) + ':' + pad(now.getMinutes());
  const prefs = String(S.meta.aiPrefs || '').trim();   // your own standards, like "skyr = bak van 450 g"
  const prompt = `${nevoBlock(text)}\nJe bent Knabbel, een vriendelijke rode panda in een Nederlandse calorie-app. Antwoord in het Nederlands.
De gebruiker heeft zin in: """${text.slice(0, 200)}""".
nevo: past het in zijn geheel bij één product in de NEVO-lijst (zelfde product en bereiding)? Zet dan de code bij "nevo"; de app rekent de getallen dan zelf uit voor het aantal gram. Is het alleen iets dat er dichtbij ligt (bv. kibbeling ≈ lekkerbekje), zet dan ook "benadering":true. Past niets, laat "nevo" weg.
Bepaal de kcal en macro's: met de NEVO-lijst hierboven als het product erin staat; anders schat je met gangbare Nederlandse waarden (van de winkel of fabrikant als je die kent). Je zoekt hier niets op, dus verzin geen bron. Gebruik de portie die de gebruiker noemt: een hoeveelheid ("300 gram", "2 stuks") precies, en een maat ook ("groot" of "flink" ≈ 1,5× een normale portie, "klein" ≈ 0,6×, "half" = 0,5×). Noemt de gebruiker niets, neem dan een normale portie. Noemt de gebruiker een merk, gebruik dat.
Nog over vandaag: ${r0(B.kcal - t.kcal)} kcal, eiwit ${r0(lp)} g, koolhydraten ${r0(lc)} g, vet ${r0(lf)} g (waarvan verzadigd vet nog ${r0(lsf)} g). Doel: ${GOAL_NAME[S.profile.goal] || 'afvallen'}. Het is nu ${time}.${keepTxt}
alternatief: past het niet helemaal, noem dan kort een lichter alternatief met ongeveer dezelfde smaak; anders leeg. (De app zegt zelf of het past.)${prefs ? `\nVaste standaarden van deze gebruiker (soort, merk en verpakking die hij of zij koopt; gebruik ze voor de portie): ${prefs.slice(0, 600).replace(/\n+/g, '; ')}` : ''}
De score is de voedingskwaliteit van 1 (ongezond) tot 10 (heel voedzaam, veel eiwit/vezels/groente).
maaltijd: "ontbijt", "lunch" of "diner" als dit een hele maaltijd is (ook gourmetten, uit eten, afhalen), "snack" voor een tussendoortje.
Antwoord met alleen JSON: {"maaltijd":"snack","naam":"korte naam","portie":"bv. 1 zak (150 g)","gram":150,"kcal":800,"eiwit":9,"koolhydraten":80,"vet":50,"verzadigd":5,"score":2,"bron":"NEVO of schatting","alternatief":"lichter alternatief, of leeg"}
Gaat het niet over eten of drinken: {"geen_eten":true}`;
  FIT.busy = true; const tok = FIT.token; renderFit();
  try {
    let j = await aiJSON(prompt, 45000, FIT_SCHEMA, 0, null, false, 'kandit');
    // Grams missing but in the portion ("1 bak (500 g)"): taken from there.
    if (j && !(num(j.gram) > 0)) { const m = String(j.portie || '').match(/(\d+(?:[.,]\d+)?)\s*(g|gr|gram|ml)\b/i); if (m) j.gram = num(m[1].replace(',', '.')); }
    let nv = j && NEVO && NEVO.get(num(j.nevo));
    // The same check as when logging: a NEVO line that is clearly another product is not used (the AI's own estimate
    // stays), and one with another name but close numbers counts as an approximation.
    const fg = num(j && j.gram), fits = nv && fg > 0 ? nevoFits(String(j.naam || text), num(j.kcal) / fg * 100, { p: num(j.eiwit) / fg * 100, c: num(j.koolhydraten) / fg * 100, f: num(j.vet) / fg * 100 }, nv) : 'ok';
    if (fits === 'no') nv = null;
    const approx = nv && (j.benadering === true || fits === 'approx');
    if (nv && num(j.gram) > 0) { const g = num(j.gram), per = v => r1(v * g / 100); Object.assign(j, { kcal: r0(nv.kcal * g / 100), eiwit: per(nv.p), koolhydraten: per(nv.c), vet: per(nv.f), verzadigd: nv.sf == null ? j.verzadigd : per(nv.sf), bron: 'NEVO', nevoName: (approx ? '(benadering) ' : '') + nv.name }); }
    if (!FIT.open || FIT.token !== tok) return;
    if (j && j.geen_eten) FIT.error = 'Dat lijkt geen eten of drinken. Probeer het anders te omschrijven.';
    else if (!num(j && j.kcal)) {
      FIT.error = 'Ik kon dit niet goed inschatten. Probeer het wat preciezer, bijv. "een zak paprikachips".';
      // Kept for "Deel technische info", so it can be seen what the AI did answer.
      const A2 = S.meta.ai; A2.errs = [{ at: Date.now(), kind: 'kandit', model: String(A2.lastGood || '').replace(/^gemini-/, ''), code: 'nokcal', msg: JSON.stringify(j || {}).slice(0, 120) }, ...(A2.errs || [])].slice(0, 8); save();
    }
    else {
      FIT.res = { meal: said || (['ontbijt', 'lunch', 'diner'].includes(j.maaltijd) ? j.maaltijd : null), name: String(j.naam || text).slice(0, 60), portion: String(j.portie || '').slice(0, 60), grams: num(j.gram), kcal: num(j.kcal), p: num(j.eiwit), c: num(j.koolhydraten), f: num(j.vet), sf: j.verzadigd != null ? num(j.verzadigd) : null,
                  score: clamp(r0(j.score), 0, 10) || null, msg: String(j.antwoord || '').slice(0, 260), alt: String(j.alternatief || '').slice(0, 160),
                  src: 'ai', bron: j.bron === 'NEVO' ? 'NEVO' : 'schatting', nevoName: j.nevoName || '', sources: Array.isArray(j.__bronnen) ? j.__bronnen : [] };
      // Remember it like any AI estimate: asking again, or logging it later, costs nothing.
      cachePut(text, { title: FIT.res.name, items: [fitItem(FIT.res)], mult: 1, confidence: '', score: FIT.res.score, tip: '' }); save();
      // Not in the table, or only something close: the answer shows now, and the web is searched behind it.
      if (!nv || approx) { FIT.looking = true; fitLookup(text, approx, tok); }
    }
  } catch (e) { if (!FIT.open || FIT.token !== tok) return; FIT.error = errCopy(e); }
  FIT.busy = false; renderFit();
}
const fitItem = r => mkItem({ name: r.portion ? `${r.name} (${r.portion})` : r.name, qty: 1, unit: 'portie', unitPl: 'porties', grams: r.grams, kcal: r.kcal, p: r.p, c: r.c, f: r.f, sf: r.sf });
function renderFit(){
  if (!FIT.open) return;
  const R = FIT.res, V = R ? fitVerdict(R) : null, look = V ? FIT_LOOK[V.v] : null;
  sheet('Kan dit?', `
    <p class="muted">Je hebt zin in: <b>${esc(FIT.text)}</b></p>
    ${FIT.busy ? `<div class="thinking"><span class="dots"><i></i><i></i><i></i></span><span class="grow">${esc(S.meta.pet.name)} rekent het even na…<br><span class="note" id="aiStatus">Een paar seconden.</span></span></div>` : ''}
    ${FIT.error ? `<div class="err">${esc(FIT.error)}</div>` : ''}
    ${R ? `<div class="fitcard">
        <div class="pet m-${look[2]}${reduceMotion() ? '' : ' alive'}" style="width:96px">${petSVG(look[2], S.meta.pet.wear)}</div>
        <div class="grow" style="display:flex;flex-direction:column;gap:8px;min-width:0">
          <span class="pill ${look[1]}" style="align-self:flex-start">${look[0]}</span>
          <p class="bubble">${esc(R.msg || fitLocalText(R, V))}</p>
          ${FIT.looking ? `<p class="note looking">🔎 Ik zoek het nog op…</p>` : ''}
        </div></div>
      ${fitWeekHTML(R, V)}
      <div class="card eqs" style="background:var(--surface2)">
        <div class="eq"><span>${esc(R.name)}${R.portion ? ` <span class="note">· ${esc(R.portion)}</span>` : ''}${R.bron ? (/^schatting/i.test(R.bron) ? ' <span class="tag">≈ schatting</span>' : ` <span class="tag">📖 ${esc(R.bron)}</span>`) : ''}${R.nevoName ? `<br><span class="note">NEVO: ${esc(R.nevoName)}</span>` : ''}${V.meal ? ` <span class="note">· als je ${MEAL_NAME(V.meal)}</span>` : ''}</span><b class="num">${r0(R.kcal)} kcal</b></div>
        <div class="eq"><span>Nog over vandaag</span><b class="num">${r0(Math.max(0, V.allLeft))} kcal</b></div>
        ${V.reserve ? `<div class="eq minus"><span>Bewaren voor je ${andList(V.later)}</span><b class="num">− ${r0(V.reserve)}</b></div>` : ''}
        <div class="eq total"><span>${V.reserve ? 'Daarna nog vrij' : 'Daarna over'}</span><b class="num" style="color:${V.left - R.kcal < -100 ? 'var(--warn-ink)' : 'var(--leaf)'}">${numStr(r0(V.left - R.kcal))} kcal</b></div>
      </div>
      <div class="fitmac" role="table" aria-label="Eiwit, koolhydraten en vet">
        <span class="h" role="columnheader"></span><span class="h" role="columnheader">hierin</span><span class="h" role="columnheader">nog over</span><span class="h" role="columnheader" aria-label="beoordeling"></span>
        ${[['Eiwit', R.p, V.lp, V.protein ? 'plus' : 'ok'], ['Koolhydraten', R.c, V.lc, V.overC ? 'over' : 'ok'], ['Vet', R.f, V.lf, V.overF ? 'over' : 'ok']].map(([l, v, left, st]) =>
          `<span>${l}</span><b class="num">${r0(v)} g</b><span class="num muted">${r0(Math.max(0, left))} g</span><span class="st st-${st}" aria-label="${st === 'over' ? 'te veel' : st === 'plus' ? 'pluspunt' : 'past'}">${st === 'over' ? '⚠︎' : st === 'plus' ? '💪' : '✓'}</span>`).join('')}
      </div>
      ${R.alt ? `<p class="note"><b>Lichter alternatief:</b> ${esc(R.alt)}</p>` : ''}
      <div class="row wrap" style="gap:8px">
        ${V.v === 'deels' ? `<button class="btn" data-act="fit-log" data-frac="${V.frac}">+ ${R.grams > 0 ? r0(R.grams * V.frac / 5) * 5 + ' g' : fracStr(V.frac) + ' portie'} loggen</button><button class="btn ghost" data-act="fit-log" data-frac="1">Toch ${R.grams > 0 ? r0(R.grams) + ' g' : 'een hele'}</button>`
          : `<button class="btn" data-act="fit-log" data-frac="1">+ Ik eet dit</button>`}
        ${V.v !== 'ja' ? `<button class="btn ghost" data-act="fit-ideas">💡 Wat past wél?</button>` : ''}
      </div>
      ${R.cached ? '' : sourcesHTML(R)}
      <p class="note">${R.cached ? 'Eerder uitgerekend, dus zonder AI-vraag. ' : ''}Dit is een schatting. Na het loggen kun je de hoeveelheid nog aanpassen.</p>` : ''}`);
}

/* ---------- ask Knabbel from the Today page ---------- */
let ASK = false;
function openAsk(){
  L = null; C = null; W = null; LAYOUT = false; ASK = true; FIT.open = false;
  renderAsk(); advise();
}
function renderAsk(){
  if (!ASK) return;
  sheet(`${S.meta.pet.name} denkt mee`, `
    ${A.busy ? `<div class="thinking"><span class="dots"><i></i><i></i><i></i></span><span class="grow">${esc(S.meta.pet.name)} kijkt in de voorraadkast…<br><span class="note" id="aiStatus">Meestal binnen 5 tot 15 seconden.</span></span></div>` : ''}
    ${A.error ? `<div class="err">${esc(A.error)}${/sleutel/.test(A.error) ? ' <button class="add-line" data-act="goto-ai">Naar instellingen</button>' : ''}</div>` : ''}
    ${!A.busy && A.res ? `<section class="card">${ideasHTML()}</section>` : ''}
    <button class="add-line" data-act="goto-advice" style="align-self:center">Meer keuzes bij Kiezen ›</button>`);
}

/* Going back further than your first logged day would shift the start of your schedule. */
const minDay = () => [firstLogKey() || todayKey(), shiftKey(todayKey(), -1)].sort()[0];
function worksHTML(d){
  const ws = d.workouts || []; if (!ws.length) return '';
  return `<div class="works">${ws.map(w => { const sp = SPORTS.find(x => x[0] === w.sport) || SPORTS[SPORTS.length - 1];
    const wkc = workoutKcal(w);
    return `<div class="row between"><span class="grow">${sp[3]} ${esc(w.label || sp[1])} · <span class="num">${w.min} min</span>${wkc.est != null ? `<span class="note num" style="display:block">ingevuld ${r0(wkc.watch)} · schatting ${r0(wkc.est)}</span>` : ''}</span><span class="num muted" style="font-weight:700">${r0(wkc.kcal)} kcal</span><button class="x" data-delwork="${w.id}" aria-label="Verwijder ${esc(w.label || sp[1])}">×</button></div>`; }).join('')}</div>`;
}
/* ---------- add a workout ---------- */
let W = null;
function openWorkout(){ L = null; C = null; W = { day: dayKey, sport: 'wandelen', min: '30', kcal: '', label: '' }; renderWorkout(); }
function renderWorkout(){
  if (!W) return;
  const sp = SPORTS.find(x => x[0] === W.sport), other = W.sport === 'anders';
  const kc = other ? num(W.kcal) : workoutKcal({ met: sp[2], min: num(W.min) }).kcal;
  sheet('Sport toevoegen', `
    <div class="sports">${SPORTS.map(([id, label, , ic]) => `<button class="chip" data-sport="${id}" aria-pressed="${W.sport === id}"><span aria-hidden="true">${ic}</span>${label}</button>`).join('')}</div>
    ${other ? `<label class="field">Wat heb je gedaan?<input id="wk-label" value="${esc(W.label)}" placeholder="Bijv. klimmen"></label>` : ''}
    <div class="grid2"><label class="field">Hoe lang (minuten)<input id="wk-min" type="text" inputmode="numeric" autocomplete="off" value="${esc(W.min)}"></label>
      ${other ? `<label class="field">Verbrand (kcal)<input id="wk-kcal" type="text" inputmode="numeric" autocomplete="off" value="${esc(W.kcal)}"></label>` : `<div class="stat" style="justify-content:flex-end"><b class="num" id="wk-prev">${r0(kc)}</b><span class="muted">kcal verbrand</span></div>`}</div>
    ${S.meta.health.on ? '<p class="note">Vul alleen in wat je horloge of telefoon niet al heeft gemeten, anders telt het dubbel.</p>' : ''}
    <div class="savebar"><button class="btn grow" data-act="save-workout">Opslaan</button></div>`);
}
function saveWorkout(){
  const min = r0(num(($('#wk-min') || {}).value ?? W.min));
  const other = W.sport === 'anders', kcal = other ? r0(num(($('#wk-kcal') || {}).value ?? W.kcal)) : null;
  if (!min) { toast('Vul in hoeveel minuten je hebt gesport.'); return; }
  if (other && !kcal) { toast('Vul in hoeveel kcal je ongeveer verbrandde.'); return; }
  const sp = SPORTS.find(x => x[0] === W.sport);
  const wk = { id: uidGen(), sport: W.sport, min, ...(other ? { kcal, label: (($('#wk-label') || {}).value || '').trim().slice(0, 40) || 'Sport' } : { met: sp[2] }) };
  const d = ensureDay(W.day); (d.workouts ||= []).push(wk);
  save(); closeSheet(); checkMoveGoal(); render();
  toast(`${other ? wk.label : sp[1]} toegevoegd · ${r0(workoutKcal(wk).kcal)} kcal`);
}

/* How nourishing a day was: the average score of what you ate, weighted by kcal (a 9 for a cucumber shouldn't make up
   for a 4 for a big pizza),
   +1 for reaching your protein goal, +½ for drinking enough, −1 when well over your eat goal. */
function dayScore(k){
  const es = day(k).entries.filter(e => e.score && !e.pending); if (!es.length) return null;
  const wt = e => Math.max(e.kcal || 0, 20);
  const avg = es.reduce((a, e) => a + e.score * wt(e), 0) / es.reduce((a, e) => a + wt(e), 0);
  const t = totals(k), M = macroGoals(k), B = budget(k).kcal, parts = [];
  let sc = avg;
  if (t.p >= M.p * 0.9) { sc += 1; parts.push(['Eiwitdoel gehaald', '+1']); }
  if (fluidMl(k) >= waterGoal(k)) { sc += 0.5; parts.push(['Genoeg gedronken', '+½']); }
  if (t.kcal > B * 1.15) { sc -= 1; parts.push(['Ruim boven je eetdoel', '−1']); }
  if (t.sf > M.sfMax * 1.25) { sc -= 0.5; parts.push(['Veel verzadigd vet', '−½']); }
  return { score: clamp(Math.round(sc), 1, 10), avg: r1(avg), parts, n: es.length, all: day(k).entries.filter(e => !e.pending).length };
}
/* Each scored meal with its score and how much it counts (its share of the kcal), so the average can be followed. */
function scoreWeightsHTML(k){
  const es = day(k).entries.filter(e => e.score && !e.pending); if (es.length < 2) return '';
  const wt = e => Math.max(e.kcal || 0, 20), w = es.reduce((a, e) => a + wt(e), 0);
  return `<div class="card eqs">${es.map(e => `<div class="eq"><span>${esc(e.name)}<br><span class="note">${r0(e.kcal)} kcal · telt voor ${r0(wt(e) / w * 100)}%</span></span><b class="score" style="${scoreStyle(e.score)}">${e.score}</b></div>`).join('')}</div>`;
}
function dayScoreHTML(k){
  const D = dayScore(k); if (!D) return '<p>Nog geen maaltijden met een score.</p>';
  return `<p>Hoe gezond at je ${k === todayKey() ? 'vandaag' : 'die dag'}? Dat zie je aan je dagscore, van 1 tot 10.</p>
    <p>Groente, fruit, eiwit en vezels maken je score hoger. Suiker en bewerkt eten maken hem lager.</p>
    <p>Een grote maaltijd telt zwaarder mee dan een klein tussendoortje: elke maaltijd telt mee naar hoeveel kcal hij had.</p>
    ${scoreWeightsHTML(k)}
    <div class="card eqs"><div class="eq"><span>Gemiddelde van je maaltijden, naar kcal${D.n < D.all ? ` (${D.n} van ${D.all} hebben een score)` : ''}</span><b class="num">${String(D.avg).replace('.', ',')}</b></div>
      ${D.parts.map(([l, v]) => `<div class="eq ${v.startsWith('−') ? 'minus' : 'plus'}"><span>${l}</span><b>${v}</b></div>`).join('')}
      <div class="eq total"><span>Dagscore</span><b class="num">${D.score}/10</b></div></div>
    ${k === todayKey() ? scoreTipsHTML(k, D) : ''}
    <p class="note">De score per maaltijd komt van de AI, of van de Nutri-Score van een product. Eten zonder score (bijvoorbeeld zelf ingevuld) krijgt er even later vanzelf een.</p>`;
}
/* What still raises today's score, concretely: protein, drinking, something green, and what to watch out for.
   Worked out with the same rules as the score itself, so the "then you get" number is honest. */
function scoreTipsHTML(k, D){
  if (D.score >= 10) return '<p class="bubble">Een 10! Beter wordt het niet. 🎉</p>';
  const es = day(k).entries.filter(e => e.score && !e.pending), wt = e => Math.max(e.kcal || 0, 20);
  const sum = es.reduce((a, e) => a + e.score * wt(e), 0), w = es.reduce((a, e) => a + wt(e), 0);
  const t = totals(k), M = macroGoals(k), B = budget(k).kcal, fl = fluidMl(k), wg = waterGoal(k), tips = [];
  let sc = D.avg + D.parts.reduce((a, [, v]) => a + (v === '+1' ? 1 : v === '+½' ? .5 : v === '−1' ? -1 : v === '−½' ? -.5 : 0), 0);
  const greenAvg = (sum + 9 * 250) / (w + 250), green = greenAvg - D.avg;
  if (green >= 0.25 && t.kcal + 250 <= B * 1.15) { tips.push(['🥦', 'Een groenterijke maaltijd of een stuk fruit erbij (± 250 kcal)', `+${String(r1(green)).replace('.', ',')}`]); sc += green; }
  if (t.p < M.p * 0.9) { tips.push(['💪', `Nog ${r0(M.p - t.p)} g eiwit, bijvoorbeeld kwark, kip of een ei`, '+1']); sc += 1; }
  if (fl < wg) { tips.push(['💧', `Nog ${r0((wg - fl) / 50) * 50} ml drinken`, '+½']); sc += .5; }
  const warn = [];
  if (t.kcal <= B * 1.15) warn.push(`Blijf onder ± ${r0(B * 1.15 / 10) * 10} kcal vandaag, anders gaat er 1 punt af.`);
  if (t.sf <= M.sfMax * 1.25 && t.sf > M.sfMax * 0.8) warn.push(`Nog maar ${r0(M.sfMax * 1.25 - t.sf)} g verzadigd vet tot het een half punt kost.`);
  const after = clamp(Math.round(sc), 1, 10);
  return `<div class="scoretips"><span class="eyebrow">Zo krijg je je score vandaag hoger</span>
    ${tips.length ? tips.map(([ic, l, v]) => `<div class="st-row"><span aria-hidden="true">${ic}</span><span class="grow">${l}</span><b class="num">${v}</b></div>`).join('') : '<p class="muted" style="margin:0">Je hebt er vandaag al uitgehaald wat erin zat. Morgen weer!</p>'}
    ${tips.length && after > D.score ? `<p style="margin:2px 0 0"><b>Dan kom je op een ${after}.</b></p>` : ''}
    ${warn.map(x => `<p class="note" style="margin:0">⚠︎ ${x}</p>`).join('')}</div>`;
}

/* The least you should eat per day. Below this you miss nutrients and lose muscle more easily. */
/* Steps per app (phone, watch, fitness app), next to the total Health Connect counts. With more than one app Health
   Connect picks one per moment by your app priority, so an app can show more or fewer steps than Knabbel. */
/* Readable names when Android doesn't give an app's name (it only shows names of apps Knabbel may see). */
const APP_NAME = { 'com.sec.android.app.shealth': 'Samsung Health', 'com.google.android.apps.fitness': 'Google Fit', 'com.google.android.apps.healthdata': 'Telefoon (Health Connect)',
  'android': 'Telefoon', 'com.fitbit.FitbitMobile': 'Fitbit', 'com.garmin.android.apps.connectmobile': 'Garmin Connect', 'com.huawei.health': 'Huawei Gezondheid',
  'com.mi.health': 'Mi Fitness', 'com.xiaomi.wearable': 'Mi Fitness', 'com.huami.watch.hmwatchmanager': 'Zepp', 'com.withings.wiscale2': 'Withings', 'com.strava': 'Strava', 'com.oura.android': 'Oura' };
/* A readable app name: known apps by name, the phone's own step counter (Health Connect writes it under a long
   "com.android.healthconnect.phone.…" name) as "Telefoon", any other package name shortened to its app part. */
function appName(a){
  if (APP_NAME[a]) return APP_NAME[a];
  if (/^com\.android\.healthconnect|^android$|healthdata/i.test(a)) return 'Telefoon';
  if (/shealth/i.test(a)) return 'Samsung Health';
  if (/^[\w]+(\.[\w-]+)+$/.test(a)) {   // a package name: the most telling part, e.g. com.example.stepcounter → Stepcounter
    const part = a.split('.').filter(x => !/^(com|org|net|nl|android|app|apps|mobile|google|phone|[0-9a-f]{8,})$/i.test(x)).pop() || a;
    return part.charAt(0).toUpperCase() + part.slice(1);
  }
  return a;
}
function stepSrcHTML(mv){
  const src = mv && mv.stepSrc; if (!src) return '';
  const list = Object.entries(src).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]); if (!list.length) return '';
  const nl = n => Math.round(n).toLocaleString('nl-NL'), hc = mv.hcSteps ?? mv.steps ?? 0;
  const pick = S.meta.health.stepsFrom || 'max';
  const row = (v, label, n) => `<button class="srcopt" data-stepsfrom="${esc(v)}" aria-pressed="${pick === v}"><span class="tick" aria-hidden="true">${pick === v ? '✓' : ''}</span><span class="grow">${label}</span><b class="num">${nl(n)}</b></button>`;
  return `<details class="infox stepsrc"><summary><i aria-hidden="true">i</i>Stappen per app</summary>
    <p class="note">Welke stappen telt Knabbel? Health Connect kiest bij telefoon én horloge per moment één app en laat zo vaak horlogestappen weg.</p>
    <div class="srcopts" role="group" aria-label="Welke stappen telt Knabbel">
      ${row('max', 'De meeste <span class="note">(aanbevolen)</span>', Math.max(...list.map(x => x[1])))}
      ${list.length > 1 ? list.map(([a, n]) => row(a, esc(appName(a)), n)).join('') : ''}
      ${row('hc', 'Health Connect-totaal', hc)}
    </div>
    <p class="note">Een app stuurt nieuwe stappen soms pas later door; Knabbel kijkt elke 5 minuten opnieuw.</p></details>`;
}
const minKcal = () => S.profile.targets?.floor || (S.profile.sex === 'm' ? 1500 : 1200);
function safetyCardsHTML(){
  const y = shiftKey(todayKey(), -1), yd = day(y), out = [];
  // A day that looks half logged: ask once.
  if (yd.entries.length && !yd.flags?.partialAsked && !isPartial(y) && !hasPending(y) && totals(y).kcal < budget(y).base * 0.5)
    out.push(`<section class="card" aria-label="Gisteren"><h3>Heb je gisteren alles gelogd?</h3>
      <p class="muted">Je logde ${r0(totals(y).kcal)} kcal. Was dat alles, of ben je iets vergeten? Een halve dag telt dan niet mee in je gemiddelde.</p>
      <div class="row wrap"><button class="btn small ghost" data-act="partial-no">Ja, dat klopt</button><button class="btn small" data-act="partial-yes">Nee, niet alles</button></div></section>`);
  // Three full days in a row under the minimum: a gentle word.
  // (the 3 most recent fully logged days within the last 5)
  const last3 = [1, 2, 3, 4, 5].map(i => shiftKey(todayKey(), -i)).filter(fullDay).slice(0, 3);
  if (!(S.meta.lowWarnUntil > todayKey()) && last3.length === 3 && last3.every(k => totals(k).kcal < minKcal()))
    out.push(`<section class="card" aria-label="Te weinig gegeten" style="border:2px solid var(--warn)"><div class="row between"><h3>Je eet wel erg weinig</h3><button class="icon-btn" data-act="low-later" aria-label="Later" style="background:var(--surface2)">×</button></div>
      <p class="muted">De afgelopen 3 dagen at je minder dan ${minKcal()} kcal. Zo weinig eten kost spieren en energie, en het maakt volhouden juist moeilijker. Probeer minstens ${minKcal()} kcal per dag te eten.</p>
      <button class="btn small outline" data-nav="advice" style="align-self:flex-start">💡 Ideeën voor een goede maaltijd</button></section>`);
  // You got lighter and your pace is now more than 1% of your weight per week.
  const P = S.profile;
  if (P.goal === 'lose' && P.rate > P.weight * 0.01 && !(S.meta.rateWarnUntil > todayKey()))
    out.push(`<section class="card" aria-label="Afvaltempo" style="border:2px solid var(--warn)"><div class="row between"><h3>Tijd voor een rustiger tempo</h3><button class="icon-btn" data-act="rate-later" aria-label="Later" style="background:var(--surface2)">×</button></div>
      <p class="muted">${rateStr(P.rate)} kg per week is nu meer dan 1% van je gewicht (${kgStr(P.weight)} kg). Sneller afvallen kost dan vooral spieren. ${rateStr(safeRate(P.weight))} kg per week is gezonder en houd je makkelijker vol.</p>
      <button class="btn small" data-act="rate-fix" style="align-self:flex-start">Zet op ${rateStr(safeRate(P.weight))} kg per week</button></section>`);
  return out.join('');
}

/* ---------- tip of the week ---------- */
const TIPS = [
  ['Eiwit houdt je langer vol', 'Eiwit (kwark, eieren, kip, peulvruchten) verzadigt beter dan koolhydraten of vet. Een beetje eiwit bij elke maaltijd helpt tegen snaaien.'],
  ['De weegschaal schommelt', 'Je gewicht kan per dag 1 à 2 kg verschillen door vocht, zout en wat er in je darmen zit. Kijk naar de trend over weken, niet naar één ochtend.'],
  ['Drinken telt mee', 'Dorst voelt soms als honger. Een glas water of thee voor het eten helpt je om rustiger te eten.'],
  ['Verborgen kcal', 'Olie, boter, sauzen en dressing zijn klein van formaat maar groot in kcal: 1 eetlepel olie is al 90 kcal.'],
  ['Groente vult zonder veel kcal', 'Met een half bord groente eet je een grote portie voor weinig kcal, en je krijgt vezels en vitamines.'],
  ['Slaap en honger', 'Na een korte nacht heb je vaak meer trek in zoet en vet. Goed slapen maakt afvallen makkelijker.'],
  ['Eén dag is geen week', 'Een feestje of uitschieter maakt weinig uit. Het gaat om je gemiddelde over de week. Gewoon weer verder bij de volgende maaltijd.'],
  ['Langzaam eten', 'Je verzadigingsgevoel komt pas na zo\'n 20 minuten. Rustig eten helpt je om op tijd te merken dat je genoeg hebt.'],
  ['Vloeibare kcal', 'Frisdrank, sap en alcohol vullen nauwelijks maar tellen wel mee. Water, thee of zwarte koffie zijn een makkelijke winst.'],
  ['Kracht beschermt je spieren', 'Een paar keer per week krachttraining zorgt dat je vooral vet verliest en je spieren houdt.'],
  ['Plannen helpt', 'Weet je wat je vanavond eet, dan is de kans kleiner dat je onderweg iets snels pakt. Kijk bij Kiezen voor ideeën.'],
  ['Wegen of schatten', 'Een paar keer je portie wegen (rijst, pasta, pindakaas) maakt je schattingen daarna een stuk beter.'],
  ['Honger of trek?', 'Echte honger komt langzaam en alles smaakt dan. Trek komt plots en wil iets specifieks. Even wachten helpt bij trek.'],
  ['Vezels', 'Volkoren brood, havermout, peulvruchten en groente houden je bloedsuiker rustiger en je langer verzadigd.'],
  ['Je verbruik verandert', 'Als je lichter wordt, verbruik je iets minder. Daarom stelt Knabbel je eetdoel bij het weegmoment zo nodig bij.'],
  ['Stappen tellen', 'Wandelen is de makkelijkste beweging: 30 minuten stevig wandelen kost al gauw 120 kcal, en het is goed voor je humeur.'],
  ['Ontbijt met eiwit', 'Een ontbijt met eiwit (kwark, skyr, eieren) houdt je tot de lunch beter vol dan alleen brood of cornflakes.'],
  ['Kleiner bord', 'Op een kleiner bord ziet dezelfde portie er groter uit. Je ogen eten mee.'],
  ['Eerst groente', 'Begin je maaltijd met de groente of een salade. Dan heb je al wat in je maag voor de rest komt.'],
  ['Snaaien voor de tv', 'Eten voor een scherm gaat ongemerkt door. Schep een portie in een schaaltje en zet de zak terug.'],
  ['Boodschappen met een lijstje', 'Wat niet in huis is, eet je niet. Een lijstje en niet met honger naar de winkel scheelt veel.'],
  ['Alcohol telt dubbel', 'Een glas wijn of een glas pils is ±100 kcal, speciaalbier al gauw ±200. En na een paar glazen wordt snacken ook makkelijker.'],
  ['Saus apart', 'Vraag saus of dressing apart. Dan bepaal je zelf hoeveel, en dat scheelt vaak 100 kcal of meer.'],
  ['Volkoren kiezen', 'Volkoren brood, pasta en rijst hebben meer vezels. Je zit sneller vol voor dezelfde kcal.'],
  ['Fruit in plaats van sap', 'Een sinaasappel vult, een glas sap nauwelijks, terwijl het sap meer suiker heeft.'],
  ['Peulvruchten', 'Linzen, kikkererwten en bonen zijn goedkoop en zitten vol eiwit en vezels. Lekker in soep, salade of curry.'],
  ['Soep vooraf', 'Een kom heldere soep voor het eten vult je maag met weinig kcal, zodat je daarna minder eet.'],
  ['Snack met een plan', 'Plan je tussendoortje, bijvoorbeeld fruit met een handje noten. Dan grijp je minder snel naar koek.'],
  ['Noten zijn gezond, maar...', 'Een handje noten (25 g) is ±150 kcal. Gezond vet, maar tel het wel mee.'],
  ['Zoet zonder suiker', 'Zin in zoet? Bevroren fruit, kwark met kaneel of een stukje pure chocola gaan verder dan een koek.'],
  ['Wegen helpt je trend', 'Weeg je vaker (liefst elke ochtend), dan ziet Knabbel sneller je echte trend.'],
  ['Stress-eten', 'Eet je bij stress of verveling? Even wandelen, iets drinken of iemand bellen helpt vaak beter dan eten.'],
  ['Restaurant-tip', 'Uit eten? Kies gegrild in plaats van gefrituurd, en deel een toetje. Genieten mag gewoon.'],
  ['Niet alles of niets', 'Eén koekje is geen mislukte dag. Log het gewoon en ga verder, dat maakt het verschil.'],
  ['Meal prep', 'Kook in één keer voor twee of drie dagen. Dan heb je altijd iets goeds klaar als je moe bent.'],
  ['Koolhydraten zijn niet slecht', 'Brood, rijst en aardappels mogen gewoon. Het gaat om de hoeveelheid en wat je erbij eet.'],
  ['Keuken dicht', 'Na het avondeten je tanden poetsen of een kauwgompje nemen is voor veel mensen een signaal: de keuken is dicht.'],
  ['Trap in plaats van lift', 'Kleine dingen tellen op: de trap, een stukje fietsen of even lopen na het eten.'],
  ['Na het eten wandelen', 'Tien minuten wandelen na het eten helpt je bloedsuiker en voelt fijn.'],
  ['Water bij je', 'Een fles water bij je hebben maakt drinken makkelijk. Vaak zit je dan vanzelf aan je doel.'],
  ['Eiwit verdelen', 'Je spieren hebben het meest aan 25 tot 40 g eiwit per maaltijd, verdeeld over de dag.'],
  ['Weekend', 'In het weekend eten veel mensen meer. Plan één leuk moment en houd de rest van de dag gewoon.'],
  ['Honger is geen vijand', 'Een beetje trek voor de maaltijd is normaal als je afvalt. Echte honger moet je wel serieus nemen.'],
  ['Kruiden en specerijen', 'Kruiden, knoflook, citroen en peper geven smaak zonder kcal. Dan heb je minder saus nodig.'],
  ['Geduld', 'Een halve kilo per week lijkt weinig, maar na een half jaar is het ruim 12 kilo. Volhouden wint.']
];
/* After a short night (from Health Connect, under 6,5 hours) one of these comes instead of the usual tip. */
const SLEEP_TIPS = [
  ['Korte nacht, meer trek', 'Na weinig slaap maakt je lichaam meer van het hongerhormoon en minder van het verzadigingshormoon. Meer trek vandaag is dus normaal, kies eten met eiwit en vezels.'],
  ['Moe? Eerst water', 'Moeheid voelt soms als honger. Drink eerst een glas water of thee, en kijk dan of je nog trek hebt.'],
  ['Slaap en zoet', 'Na een korte nacht heb je vooral zin in zoet en vet. Leg vandaag fruit en kwark klaar, dan heb je een goed alternatief bij de hand.'],
  ['Vanavond eerder naar bed', 'Mensen die genoeg slapen (7 à 9 uur) eten gemiddeld minder en verliezen bij afvallen meer vet en minder spieren.'],
  ['Cafeïne op tijd', 'Koffie helpt vandaag, maar liefst niet meer na 14:00. Dan slaap je vannacht beter.'],
  ['Schermen uit', 'Een uur voor het slapen geen telefoon of tv helpt je sneller in slaap te vallen. Goede slaap maakt minder snaaien makkelijker.']
];
const dayNo = () => daysBetween('2026-01-05', todayKey());
function tipHTML(){
  if (S.meta.tipHidden === todayKey()) return '';
  const sl = sleepLast(), short = sl > 0 && sl < 390, list = short ? SLEEP_TIPS : TIPS;
  const [title, text] = list[((dayNo() % list.length) + list.length) % list.length];
  return `<details class="card tipcard tipline" aria-label="Tip van de dag"><summary><span aria-hidden="true">${short ? '😴' : '💡'}</span><span class="grow"><b>${title}</b></span><span class="note">tip</span>${CHEV}</summary>
    <div><p class="muted">${text}</p><button class="add-line" data-act="tip-hide" style="align-self:flex-start">Vandaag niet meer tonen</button></div></details>`;
}

function backupDue(){
  if (S.meta.backupNudgeUntil > todayKey()) return false;
  if (autoOn() && !S.meta.autoBackup.err) return false;   // the folder backup keeps itself up to date
  const f = firstLogKey(); if (!f || daysBetween(f, todayKey()) < 7) return false;
  // In Safari (iPhone) the data can be cleared when the phone runs out of space, so there every week.
  return !S.meta.lastBackup || daysBetween(S.meta.lastBackup, todayKey()) >= (Native ? 30 : 7);
}

