/* The log sheet. */
/* ---------- log sheet ---------- */
let L = null;
function recentFoods(){
  const seen = new Set(), out = [];
  Object.keys(S.days).sort().reverse().some(k => { [...(S.days[k].entries || [])].reverse().forEach(e => { if (e.pending) return; const n = String(e.name || '').toLowerCase(); if (n && !seen.has(n)) { seen.add(n); out.push(e); } }); return out.length >= 10; });
  return out.slice(0, 10);
}
/* Everything you ever logged, one row per name, most eaten first (then most recent). */
let foodHistoryMemo = null;
function foodHistory(){
  if (foodHistoryMemo && foodHistoryMemo.v === dataVer) return foodHistoryMemo.list;
  const list = foodHistoryBuild(); foodHistoryMemo = { v: dataVer, list }; return list;
}
function foodHistoryBuild(){
  const map = new Map();
  Object.keys(S.days).sort().forEach(k => (S.days[k].entries || []).forEach(e => {
    if (e.pending) return;
    const n = String(e.name || '').trim().toLowerCase(); if (!n) return; const cur = map.get(n);
    map.set(n, { e, count: (cur ? cur.count : 0) + 1, last: k });
  }));
  return [...map.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last));
}
const favKey = name => String(name || '').trim().toLowerCase();
const isFav = name => (S.meta.favs || []).some(f => favKey(f.name) === favKey(name));
function templateFrom(e){
  const items = (e.items?.length ? e.items : [{ name: e.name, qty: 1, unit: 'portie', unitPl: 'porties', kcal: e.kcal, p: e.p, c: e.c, f: e.f, sf: e.sf }])
    .map(({ base, ...i }) => ({ ...i }));
  return { name: e.name || e.title, icon: e.icon || '', items, mult: e.mult || 1, score: e.score || null, src: e.src || 'manual' };
}
function buildEntry(tpl, meal){
  const items = tpl.items.map(mkItem), mult = tpl.mult || 1, t = itemsTotals(items, mult);
  return { id: uidGen(), t: Date.now(), meal, name: tpl.name, icon: tpl.icon || '', mult,
           items: items.map(({ base, ...i }) => ({ ...i, kcal: r1(i.kcal), p: r1(i.p), c: r1(i.c), f: r1(i.f), ...sfOut(i), ...(i.ml != null ? { ml: r0(i.ml) } : {}) })),
           kcal: r0(t.kcal), p: r1(t.p), c: r1(t.c), f: r1(t.f), sf: t.sf != null ? r1(t.sf) : null, src: tpl.src || 'manual', score: tpl.score || null, tip: '' };
}
/* What happens after any new entry: first-day setup, rewards, eat-goal bonus, reminder. */
/* Ends the running fast and keeps it in the log. Returns how many hours it lasted. */
function stopFast(){
  if (Native) nat('fast.cancel').catch(() => {});
  const F = S.meta.fast, h = (Date.now() - F.start) / 3.6e6;
  if (h >= 0.1) F.log.push({ end: Date.now(), h: r1(h), goal: F.goal });
  F.log = F.log.filter(x => x.h >= 0.1).slice(-60);
  const hit = h >= F.goal; F.start = null; save();
  if (hit) reward(5, 10, 'Vastendoel gehaald!');
  return h;
}
function afterNewEntries(d, wasFirst, count){
  /* Eating ends the fast: you easily forget the timer is still running. Water or black coffee (under 20 kcal) doesn't count. */
  const fresh = d.entries.slice(-count);
  if (dayKey === todayKey() && S.meta.fast.start && S.meta.fast.start < Date.now() && fresh.some(e => e.pending || e.kcal >= 20)) {
    const h = stopFast();
    setTimeout(() => toast(`Vasten gestopt: je hebt ${fmtHours(h)} gevast.`), 1200);
  }
  // Seeds once per meal per day (deleting and logging again doesn't count twice); xp stays per item.
  const older = d.entries.slice(0, -count), seen = d.flags.seedMeals ||= [];
  const gain = [...new Set(fresh.filter(e => !older.some(o => o.meal === e.meal)).map(e => e.meal))].filter(m => !seen.includes(m));
  seen.push(...gain);
  reward(3 * gain.length, 10 * count, null, gain.length ? `${gain.map(m => MEAL_SHORT[m]).join(' + ')} gelogd` : 'Eten gelogd');
  if (wasFirst) {
    if (!S.meta.weights.some(w => w.date === dayKey)) { S.meta.weights.push({ date: dayKey, kg: S.profile.weight }); save(); }
    setTimeout(() => toast(`Je eerste dag! Over 7 dagen (${shortDate(shiftKey(firstLogKey(), 7))}) vraag ik je gewicht.`), 3500);
    if (Native) nat('notify.permission').catch(() => {});
  }
  scheduleReminder();
  checkWaterGoal(dayKey);
  if (dayKey === todayKey() && d.entries.length === count && S.meta.streakShown !== todayKey()) {
    S.meta.streakShown = todayKey(); save();
    setTimeout(openStreak, 700);
  }
  checkGoalToday();
  return 3 * gain.length;
}
/* Your eat goal counts as reached once the day is over: fully logged and between 90% and 110% of the goal.
   Checked the next time you open the app (up to 3 days back), so eating a lot later in the day can't undo it. */
/* "Eetdoel gehaald": in the evening (from 20:00) when you are between 90% and 110% of your goal. Go far over it
   afterwards (more than 115%) and it is taken back. Didn't open the app in the evening? Then the day is checked the
   next morning (up to 3 days back). */
const goalOk = k => { const t = totals(k).kcal, B = budget(k).kcal; return day(k).entries.length >= 2 && !hasPending(k) && t >= B * 0.9 && t <= B * 1.1; };
const goalOver = k => totals(k).kcal > budget(k).kcal * 1.15;
function takeGoalBack(d, k, quiet){
  d.flags.goal = false; const P = S.meta.pet, back = Math.min(10, P.seeds);
  P.seeds -= back; P.xp = Math.max(0, P.xp - 25); seedLog(-back, 'Eetdoel toch niet gehaald'); save();
  if (!quiet) toast(`Je zit nu ruim boven je eetdoel, dus ${k === todayKey() ? 'vandaag' : 'die dag'} telt niet meer als gehaald (−10 🌻). Geeft niks, morgen weer!`);
}
function checkGoalToday(){
  if (!S.profile) return;
  const k = todayKey(), d = S.days[k]; if (!d) return;
  d.flags ||= {};
  if (d.flags.goal && goalOver(k)) { takeGoalBack(d, k); render(); return; }
  if (!d.flags.goal && new Date().getHours() >= 20 && goalOk(k)) { d.flags.goal = true; save(); setTimeout(() => reward(10, 25, 'Eetdoel gehaald!'), 1200); }
}
function settleGoals(){
  if (!S.profile) return;
  let got = 0;
  [1, 2, 3].map(i => shiftKey(todayKey(), -i)).forEach(k => {
    const d = S.days[k]; if (!d || d.flags?.goalChecked) return;
    d.flags ||= {}; d.flags.goalChecked = true;
    if (d.flags.goal) { if (goalOver(k)) takeGoalBack(d, k, true); return; }
    if (fullDay(k) && goalOk(k)) { d.flags.goal = true; got++; }
  });
  save();
  if (got) setTimeout(() => reward(10 * got, 25 * got, got === 1 ? 'Gisteren je eetdoel gehaald!' : `${got} dagen je eetdoel gehaald!`), 1500);
  checkGoalToday();
}
/* A short celebration after the first meal of the day: your streak and this week at a glance. */
function openStreak(){
  if (sheetOpen()) return;
  const n = streak(), today = dateOf(todayKey()), mon = shiftKey(todayKey(), -((today.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => shiftKey(mon, i));
  sheet(n === 1 ? 'Een nieuwe reeks!' : `${n} dagen op rij!`, `
    <div class="streakhero"><div class="pet m-happy${reduceMotion() ? '' : ' alive hop'}" aria-hidden="true">${petSVG('happy', S.meta.pet.wear)}</div>
      <span class="num streaknum">${flameSVG(n)} ${n}</span>${(() => { const nx = [...FLAMES].reverse().find(f => f[0] > n); return nx ? `<p class="note">Nog ${nx[0] - n} ${nx[0] - n === 1 ? 'dag' : 'dagen'}, dan wordt het een ${nx[1].toLowerCase()} ${flameSVG(nx[0])}</p>` : `<p class="note">${flameTier(n)[1]}: de mooiste vlam die er is!</p>`; })()}<p class="muted">${n === 1 ? `${esc(S.meta.pet.name)} is blij dat je er bent. Log morgen weer, dan groeit je reeks.` : `Je logt al ${n} dagen achter elkaar. ${esc(S.meta.pet.name)} is trots op je!`}</p></div>
    <div class="weekstrip" role="img" aria-label="Deze week: ${days.filter(k => day(k).entries.length).length} van 7 dagen gelogd">${days.map(k => { const on = day(k).entries.length > 0, fut = k > todayKey();
      return `<div class="${on ? 'on' : ''}${k === todayKey() ? ' today' : ''}${fut ? ' later' : ''}"><i>${on ? '✓' : ''}</i>${DAYS[dateOf(k).getDay()]}</div>`; }).join('')}</div>
    ${streakTrackHTML(n)}
    <button class="btn block" data-act="close">Verder</button>`);
  confetti(30);
}
/* The streak flame grows with your streak: small and yellow at first, a big orange flame from 7 days,
   blue from 30 days, and purple with sparks from 100 days. */
const FLAMES = [[100, 'Paarse vlam', '#8E3BEF', '#C08BFF', '#F3E6FF', 1.22], [30, 'Blauwe vlam', '#2E7BEA', '#6BB8FF', '#DDF1FF', 1.14], [7, 'Grote vlam', '#E8501E', '#FFB020', '#FFE27A', 1.05], [0, 'Vlammetje', '#FFB020', '#FFD34D', '#FFF3B0', .85]];
const flameTier = n => FLAMES.find(f => n >= f[0]);
function flameSVG(n){
  const [min, , outer, mid, inner, size] = flameTier(n), O = 'M12 1 C14 6 20 9 20 17 A8 8 0 0 1 4 17 C4 12 7 10 8 6 C9 9 10 10 11 10 C11 7 11 4 12 1 Z';
  return `<svg class="flame" viewBox="0 0 24 28" style="width:${size}em;height:${(size * 28 / 24).toFixed(2)}em" aria-hidden="true">${min >= 100 ? '<circle class="spark" cx="4" cy="8" r="1.4" fill="#FFE27A"/><circle class="spark s2" cx="20" cy="6" r="1.2" fill="#FFF3B0"/>' : ''}<g class="fl"><path d="${O}" fill="${outer}"/><path d="${O}" fill="${mid}" transform="translate(12 25) scale(.72) translate(-12 -25)"/><path d="M12 11 C13 14 16 15 16 19 A4 4 0 0 1 8 19 C8 16 10 15 12 11 Z" fill="${inner}"/></g></svg>`;
}
/* How far the streak has come: milestones 3, 7, 14, 30, 60, 100 days. */
const STREAK_STEPS = [3, 7, 14, 30, 60, 100];
function streakTrackHTML(n){
  const next = STREAK_STEPS.find(m => m > n), prev = [...STREAK_STEPS].reverse().find(m => m <= n) || 0;
  return `<div class="streaktrack">
    <div class="steps">${STREAK_STEPS.map(m => `<span class="${n >= m ? 'on' : ''}${m === next ? ' next' : ''}"><i>${n >= m ? flameSVG(m) : `<span style="opacity:.35;filter:saturate(.6)">${flameSVG(m)}</span>`}</i>${m}</span>`).join('')}</div>
    ${next ? `<div class="bar"><i style="width:${r0((n - prev) / (next - prev) * 100)}%;background:var(--accent)"></i></div>
      <p class="note num">Nog ${next - n} ${next - n === 1 ? 'dag' : 'dagen'} tot ${next} dagen op rij</p>` : '<p class="note">Meer dan 100 dagen op rij. Wauw!</p>'}
  </div>`;
}
/* One tap: log a known dish straight away, with undo. */
function quickAdd(tpls, meal){
  const k = L ? L.day : dayKey, d = ensureDay(k), wasFirst = !firstLogKey();
  const added = tpls.map(tp => ({ ...buildEntry(tp, meal), t: entryTime(k, meal) }));
  d.entries.push(...added); save();
  if (L) closeSheet();
  const got = afterNewEntries(d, wasFirst, added.length) || 0, meals = got ? d.flags.seedMeals.slice(-got / 3) : [];
  flash(added[0].id, true); render();
  petEat(isDrinkEntry(added[0]) ? 'drink' : 'eat', foodIcon(added[0]));
  if (added.some(needsFill)) scoreFillSoon();
  const label = added.length === 1 ? added[0].name : `${added.length} items`;
  toast(`${label} toegevoegd${got ? ` · +${got} 🌻` : ''}`, { label: 'Ongedaan maken', fn: () => collapseThen(added.map(x => x.id), () => {
    const ids = new Set(added.map(x => x.id));
    d.entries = d.entries.filter(x => !ids.has(x.id));
    if (got) d.flags.seedMeals = d.flags.seedMeals.filter(m => !meals.includes(m));
    S.meta.pet.seeds = Math.max(0, S.meta.pet.seeds - got); S.meta.pet.xp = Math.max(0, S.meta.pet.xp - 10 * added.length); seedLog(-got, 'Ongedaan gemaakt');
    save(); render();
  }) });
}
const MEAL_SHORT = { ontbijt: 'Ontbijt', lunch: 'Lunch', diner: 'Avondeten', snack: 'Tussendoor' };
const mealSeg = () => `<div class="mealpick" role="group" aria-label="Maaltijd">${MEALS.map(([id]) => `<button data-meal-set="${id}" aria-pressed="${L.meal === id}" style="--mc:var(--m-${id})"><i aria-hidden="true">${FL('icons') ? flIcon(id) : MEAL_ICON[id]}</i>${MEAL_SHORT[id]}</button>`).join('')}</div>`;
/* Your own photo while the AI looks at it, with a scan line moving over it, so the wait has something to show. */
const photoScanHTML = () => `<div class="photoscan"><img src="${L.shot}" alt="Je foto"><i class="scanline" aria-hidden="true"></i></div>`;
function openLog(opts = {}){
  C = null;
  ASK = false; LAYOUT = false; FIT.open = false;
  L = { search: { q: '', busy: false, results: [], error: '' }, day: opts.day || dayKey, mode: opts.mode || 'text', meal: opts.meal || logMeal(opts.day || dayKey), text: opts.text || '', busy: false, error: '', errCode: '', token: 0, lists: {},
        result: opts.result || null, editId: opts.editId || null, manual: { name: opts.manualName || '', kcal: '', p: '', c: '', f: '', sf: '' } };
  renderSheet();
  // No keyboard straight away: then the barcode, search and photo buttons stay in view. Tap the text box to type.
  if (!L.result && L.mode === 'text') warmAI();
  offWarm();
}
/* Slide the sheet down, then remove it. State is cleared at once so nothing acts on a closing sheet. */
function closeSheet(){
  if (C && !C.result) { S.meta.checkinSnooze = todayKey(); save(); }  // closing the weigh-in = "not today"
  if (FIT.open) setTimeout(() => { const el = $('#fitText'); if (el) { if (!el.value) el.value = FIT.text || ''; el.focus(); el.select(); } }, 380);
  L = null; C = null; W = null; LAYOUT = false; ASK = false; FIT.open = false;
  document.body.classList.remove('typing');
  const root = $('#sheetRoot'), sc = root.querySelector('.scrim');
  if (!sc) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { root.innerHTML = ''; return; }
  sc.style.background = ''; sc.classList.add('closing');
  setTimeout(() => { if (root.querySelector('.scrim.closing') === sc) root.innerHTML = ''; }, 240);
}
function itemsTotals(items, mult = 1){
  const t = items.reduce((a, i) => ({ kcal: a.kcal + i.kcal * mult, p: a.p + i.p * mult, c: a.c + i.c * mult, f: a.f + i.f * mult, sf: a.sf + (i.sf || 0) * mult }), { kcal: 0, p: 0, c: 0, f: 0, sf: 0 });
  // Saturated fat counts only when every part with fat in it says how much; otherwise it is unknown.
  if (items.some(i => i.sf == null && i.f >= 1)) t.sf = null;
  return t;
}
const sfOut = i => i.sf != null ? { sf: r1(i.sf) } : {};
const mlLine = R => { const ml = itemsMl(R.items, R.mult || 1); return ml ? `💧 Telt mee als ${ml} ml vocht` : ''; };
function sumHTML(t){ return `<div class="sum" id="sumBox"><div><b class="num">${r0(t.kcal)}</b><span>kcal</span></div><div><b class="num">${r0(t.p)}</b><span>eiwit g</span></div><div><b class="num">${r0(t.c)}</b><span>koolh. g</span></div><div><b class="num">${r0(t.f)}</b><span>vet g</span></div></div>`; }
/* The practical measures for one item: the usual ones for this food (slice, slice of cheese, bowl ...), the portions the
   AI or the package gave (a standard portion, the whole pack), and grams or ml. */
function measureList(R, it){
  const list = measuresFor(it), g0 = it.base && it.base.g > 0 ? it.base.g : 0;
  (R.portions || []).forEach(p => {
    if (!(p.grams > 0) || R.items.length !== 1) return;
    const u = p.label.toLowerCase();
    if (list.some(m => m.u === u || Math.abs(m.g - p.grams) < 2)) return;
    list.splice(list.length - 1, 0, { u, pl: u, g: p.grams, ml: p.unit === 'ml' });
  });
  return list;
}
function sheet(title, inner, keep){
  const old = $('#sheetRoot .sheet'), top = keep && old && sheetOpen() ? old.scrollTop : 0;
  const fresh = !sheetOpen() ? ' enter' : '';
  $('#sheetRoot').innerHTML = `<div class="scrim${fresh}" data-act="scrim"><div class="sheet${fresh}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-top"><div class="grab"></div>
    <div class="row between"><h2>${esc(title)}</h2><button class="icon-btn" data-act="close" aria-label="Sluiten" style="background:var(--surface2)">×</button></div></div>
    ${inner}</div></div>`;
  if (top) $('#sheetRoot .sheet').scrollTop = top;   // same sheet, re-drawn: stay where you were
}

/* Swipe down to close: from the handle/title bar always, from the content only when it is scrolled to the top. */
let drag = null;
document.addEventListener('touchstart', e => {
  const sh = e.target.closest('.sheet'); if (!sh || sh.closest('.closing')) return;
  const onTop = !!e.target.closest('.sheet-top');
  if (!onTop && (sh.scrollTop > 0 || e.target.closest('input, textarea, select, .recent'))) return;
  drag = { sh, x0: e.touches[0].clientX, y0: e.touches[0].clientY, t0: Date.now(), dy: 0, onTop, active: false };
}, { passive: true });
document.addEventListener('touchmove', e => {
  if (!drag) return;
  const dy = e.touches[0].clientY - drag.y0, dx = e.touches[0].clientX - drag.x0;
  if (!drag.active) {
    if (Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) { drag = null; return; }   // sideways (swiping between macros): not closing
    if (dy > 6 && (drag.onTop || drag.sh.scrollTop <= 0)) { drag.active = true; drag.sh.classList.add('dragging'); drag.y0 += 6; }
    else { if (dy < -6) drag = null; return; }
  }
  drag.dy = Math.max(0, dy - 6);
  drag.sh.style.transform = `translateY(${drag.dy}px)`;
  drag.sh.parentElement.style.background = `rgb(10 14 10/${(0.45 * (1 - Math.min(1, drag.dy / drag.sh.offsetHeight))).toFixed(3)})`;
  e.preventDefault();
}, { passive: false });
function endDrag(cancel){
  if (!drag) return; const d = drag; drag = null;
  if (!d.active) return;
  d.sh.classList.remove('dragging');
  const speed = d.dy / Math.max(1, Date.now() - d.t0);
  if (!cancel && (d.dy > Math.min(140, d.sh.offsetHeight * 0.3) || (speed > 0.5 && d.dy > 30))) { closeSheet(); render(); }
  else { d.sh.style.transform = ''; d.sh.parentElement.style.background = ''; }
}
document.addEventListener('touchend', () => endDrag(false));
document.addEventListener('touchcancel', () => endDrag(true));
/* "1 portion" says nothing when the food has no usual measure: with a known weight it becomes grams (or ml), which you
   can change exactly, and which is what you weigh or read on the pack. Foods that do have measures keep "1 portion". */
function gramsFirst(R){
  (R.items || []).forEach(it => {
    if (!/^(portie|porties)$/.test(it.unit) || !(it.grams > 0) || (R.items.length === 1 && (R.portions || []).length)) return;
    const g0 = it.grams, ml = itemMl(it) > 0;
    // A usual measure that fits the weight (350 g pizza = 1 whole pizza, 150 g skyr = 1 bowl): that measure, in halves.
    const fit = measuresFor(it).filter(m => m.g > 1 && !/^portie/.test(m.u)).map(m => ({ m, q: Math.round(g0 / m.g * 2) / 2 })).filter(x => x.q >= 0.5 && Math.abs(x.q * x.m.g - g0) / g0 <= 0.06).sort((a, b) => b.m.g - a.m.g)[0];
    if (fit) { setMeasure(it, fit.m); setQty(it, fit.q); return; }
    setMeasure(it, { u: ml ? 'ml' : 'g', pl: ml ? 'ml' : 'g', g: 1, ml });
    setQty(it, r0(g0));
  });
}
function renderSheet(){
  if (W) return renderWorkout();
  if (C) return renderCheckin();
  if (!L) return;
  const R = L.result; if (R && !R.gf) { R.gf = true; gramsFirst(R); }
  // Re-drawing the same view (a + or −, a measure, a meal): keep the scroll position; a different view starts at the top.
  const sk = [L.mode, !!R, !!L.busy, L.editId || ''].join('|'), keep = L._sk === sk; L._sk = sk;
  let body = '';
  if (R) {
    const tot = itemsTotals(R.items, R.mult || 1), sus = resultSuspect(R);
    body = `
      <div class="row" style="align-items:flex-end;gap:8px"><label class="field grow">Naam<input id="r-title" value="${esc(R.title)}" maxlength="80"></label>
        <button class="icon-btn fav ${isFav(R.title) ? 'on' : ''}" data-act="fav-toggle" aria-pressed="${isFav(R.title)}" aria-label="${isFav(R.title) ? 'Uit favorieten halen' : 'Bewaren als favoriet'}">${isFav(R.title) ? '★' : '☆'}</button></div>
      ${R.score || sus || R.cached || S.meta.ai.key ? `<div class="row wrap" style="gap:8px">${R.score ? `<span class="score" style="${scoreStyle(R.score)}">Voedzaam: ${R.score}/10</span>`
        : ''}${S.meta.ai.key && (!R.score || itemsTotals(R.items, R.mult || 1).sf == null) ? `<button class="btn small ghost" data-act="score-now" ${L.scoreBusy ? 'disabled' : ''}>${L.scoreBusy ? 'Even bepalen…' : `🥦 ${!R.score && itemsTotals(R.items, R.mult || 1).sf == null ? 'Score en verzadigd vet' : !R.score ? 'Score' : 'Verzadigd vet'} laten bepalen`}</button>` : ''}${sus ? '<span class="pill warn">Onzeker: check de hoeveelheden</span>' : ''}${R.cached ? '<span class="note">Eerder uitgerekend · <button class="add-line" data-act="ai-fresh" style="min-height:32px;padding:0">opnieuw laten uitrekenen</button></span>' : ''}</div>` : ''}
      ${R.question ? `<div class="askq"><p><b>🤔 ${esc(R.question.text)}</b></p><div class="row wrap" style="gap:6px">${R.question.options.map((o, i) => `<button class="chip" data-qopt="${i}">${esc(o)}</button>`).join('')}</div>
        <button class="add-line" data-act="q-skip" style="min-height:32px;padding:0">Laat maar, de schatting is goed</button></div>` : ''}
      ${mealSeg()}
      <span class="eyebrow" style="margin-bottom:-8px">Totaal</span>
      ${sumHTML(itemsTotals(R.items, R.mult || 1))}
      <p class="note" id="mlBox" style="margin-top:-8px">${mlLine(R)}</p>
      ${sourcesHTML(R)}
      ${(() => { const it = R.items.length === 1 ? R.items[0] : null, ms = it && it.grams > 0 ? measureList(R, it) : [];
        // One product: its practical measures (slice, bowl, 100 g ...) and a stepper. Several parts: the amount per part
        // (below, open): "2 slices of bread, 3 slices of cheese" says more than "a half portion", portions differ.
        const reset = Math.abs((R.mult || 1) - 1) > 0.005 ? `<button class="add-line" data-mult="1" style="min-height:32px;padding:0">× ${fmtQty(R.mult)} van de hoeveelheid hieronder: terug naar 1×</button>` : '';
        if (ms.length < 2) return it ? `<div class="portions"><span class="eyebrow">Hoeveel heb je gegeten?</span>
        <div class="row between" style="gap:8px"><div class="stepper">
          <button data-qty="0" data-dir="-1" aria-label="Minder">−</button>
          ${isMass(it.unit) ? `<label class="massin"><input type="number" inputmode="numeric" data-mass="0" id="q-0" value="${r0(it.qty)}" aria-label="${it.unit === 'ml' ? 'Milliliter' : 'Gram'}">${it.unit}</label>` : `<span class="qty">${qtyLabel(it)}</span>`}
          <button data-qty="0" data-dir="1" aria-label="Meer">+</button></div>
          <span class="note num">${isMass(it.unit) || !(it.grams > 0) ? '' : `= ${r0(it.grams)} g`}</span></div>${reset}</div>` : reset ? `<div class="portions">${reset}</div>` : '';
        const unitW = it.unit === 'ml' || ms[0].ml ? 'ml' : 'g';
        return `<div class="portions"><span class="eyebrow">Hoeveel heb je gegeten?</span>
        <div class="portchips" role="group" aria-label="Maat">${ms.map((m, i) => `<button class="chip" data-measure="${i}" aria-pressed="${it.unit === m.u}">${m.g > 1 ? `${esc(m.u)} <span class="note num">${m.g} ${unitW}</span>` : unitW === 'ml' ? 'in ml' : 'in gram'}</button>`).join('')}</div>
        <div class="row between" style="gap:8px"><div class="stepper">
          <button data-qty="0" data-dir="-1" aria-label="Minder">−</button>
          ${isMass(it.unit) ? `<label class="massin"><input type="number" inputmode="numeric" data-mass="0" id="q-0" value="${r0(it.qty)}" aria-label="${it.unit === 'ml' ? 'Milliliter' : 'Gram'}">${it.unit}</label>` : `<span class="qty">${qtyLabel(it)}</span>`}
          <button data-qty="0" data-dir="1" aria-label="Meer">+</button></div>
          <span class="note num">${isMass(it.unit) ? '' : `= ${r0(it.grams)} ${unitW}`}</span></div></div>`; })()}
      <details class="parts"${L.partsOpen === true || sus || (R.items.length > 1 && L.partsOpen !== false) ? ' open' : ''} ontoggle="if (L) L.partsOpen = this.open"><summary><span>${R.items.length > 1 ? 'Hoeveel heb je gegeten? <span class="note">per onderdeel</span>' : 'Onderdelen aanpassen'} <span class="note">(${R.items.length})</span></span>${CHEV}</summary>
      <span class="note">Zoals ingevuld:</span>
      <div class="items">${R.items.map((it, i) => { const why = suspectWhy(it); return `<div class="item2${why ? ' suspect' : ''}">
          <div class="row between" style="gap:8px"><span class="grow" style="display:flex;flex-direction:column;gap:2px"><span class="nm">${esc(it.name)}</span>${(() => { // the labels on their own line under the name, never broken in two
            const tags = [it.hidden && '<span class="tag hid">verborgen kcal</span>', it.off && '<span class="tag pkg">📦 verpakking</span>', it.fixed && '<span class="tag">nagerekend</span>',
              it.bron && !it.off && (/^schatting/i.test(it.bron) ? '<span class="tag">≈ schatting</span>' : `<span class="tag">📖 ${esc(it.bron)}</span>`)].filter(Boolean);
            return tags.length ? `<span class="tags">${tags.join('')}</span>` : ''; })()}${it.nevo && it.nevoName ? `<span class="note">NEVO${it.approx ? ' (benadering)' : ''}: ${esc(it.nevoName)}</span>` : ''}${why ? `<span class="why">Klopt dit? ${why}</span>` : ''}</span><button class="x" data-delitem="${i}" aria-label="Verwijder ${esc(it.name)}">×</button></div>
          <div class="row between" style="gap:8px">
            <div class="stepper">
              <button data-qty="${i}" data-dir="-1" aria-label="Minder ${esc(it.name)}">−</button>
              ${isMass(it.unit) ? `<label class="massin"><input type="number" inputmode="numeric" data-mass="${i}" id="q-${i}" value="${r0(it.qty)}" aria-label="${it.unit === 'ml' ? 'Milliliter' : 'Gram'} ${esc(it.name)}">${it.unit}</label>` : `<span class="qty">${qtyLabel(it)}</span>`}
              <button data-qty="${i}" data-dir="1" aria-label="Meer ${esc(it.name)}">+</button>
            </div>
            <span class="num" style="font-weight:700" data-mc="${i}">${r0(it.kcal)} kcal</span>
          </div>${!isMass(it.unit) && it.grams > 0 ? `<span class="note num">= ${r0(it.grams)} ${itemMl(it) > 0 ? 'ml' : 'g'}</span>` : ''}</div>`; }).join('')}</div>
      </details>
      ${R.items.some(i => i.hidden) ? '<p class="note">Onderdelen met "verborgen kcal" (bakvet, boter, saus) zijn er vast bij geteld, omdat ze vaak vergeten worden. Zat het er niet in? Haal het weg met ×.</p>' : ''}
      ${S.meta.ai.key ? `<details class="parts"${L.fixOpen ? ' open' : ''} ontoggle="if (L) L.fixOpen = this.open"><summary><span>Klopt iets niet? <span class="note">(laat het aanpassen)</span></span>${CHEV}</summary>
        <div class="row" style="gap:8px;margin-top:4px"><input id="fixText" autocomplete="off" enterkeyhint="send" placeholder="Bijv. het waren 3 plakken, zonder boter"><button class="btn small" data-act="ai-fix">Aanpassen</button></div>
        <p class="note" style="padding-bottom:10px">Knabbel past de schatting aan met jouw aanvulling. Dat kost één AI-vraag.</p></details>` : ''}
      ${(() => { const tt = itemsTotals(R.items, R.mult || 1), bs = nbadgesOf({ ...tt, score: R.score, items: R.items, mult: R.mult || 1 }); return bs.length ? `<div class="nbexplain"><span class="eyebrow">Goed aan dit eten</span>${bs.map(b => `<p><span class="nb">${b[1]}</span> ${b[2]}</p>`).join('')}</div>` : ''; })()}
      ${R.tip ? `<p class="bubble">${esc(S.meta.pet.name)}: ${esc(R.tip)}</p>` : ''}
      <div class="savebar">
        ${L.editId ? '<button class="btn danger" data-act="del-entry">Verwijderen</button>' : '<button class="btn ghost" data-act="reset-log">Opnieuw</button>'}
        <button class="btn grow" data-act="save-entry" id="saveBtn">Opslaan · ${r0(tot.kcal)} kcal</button>
      </div>`;
  } else if (L.busy && L.busyText) {
    body = `${L.shot ? photoScanHTML() : ''}<div class="thinking"><span class="dots"><i></i><i></i><i></i></span><span class="grow">${esc(L.busyText)}</span></div>`;
  } else if (L.mode === 'search') {
    body = searchHTML();
  } else if (L.mode === 'photo' && !L.busy) {
    body = `<div class="card">
      ${mealSeg()}
      <p class="muted">Maak een foto van je bord, of kies er een uit je foto's. ${esc(S.meta.pet.name)} schat wat erop staat en hoeveel.</p>
      <label class="field">Iets erbij vertellen? (optioneel)<input id="photoNote" value="${esc(L.photoNote || '')}" placeholder="Bijv. groot bord, met 2 el olie gebakken"></label>
      <div class="grid2"><button class="btn" data-act="photo-take">📷 Foto maken</button><button class="btn ghost" data-act="photo-pick">🖼️ Uit je foto's</button></div>
      <p class="note">Een foto is minder precies dan beschrijven of wegen: porties en verborgen olie zijn lastig te zien. Kijk de hoeveelheden daarna even na. De foto gaat alleen naar de AI van Google en wordt niet bewaard.</p>
      <button class="add-line" data-mode="text">‹ Terug</button></div>`;
  } else if (L.busy && L.shot) {
    // Your own photo while the AI looks at it: a scan line moving over it, so the wait has something to show.
    body = `${photoScanHTML()}
      <div class="thinking"><span class="dots"><i></i><i></i><i></i></span><span class="grow">${esc(S.meta.pet.name)} bekijkt je foto…<br><span class="note" id="aiStatus">Meestal binnen 5 tot 15 seconden.</span></span><button class="btn small ghost" data-act="stop-ai">Stop</button></div>`;
  } else if (L.busy) {
    body = `<div class="thinking"><span class="dots"><i></i><i></i><i></i></span><span class="grow">${esc(S.meta.pet.name)} rekent je eten uit…<br><span class="note" id="aiStatus">Meestal binnen 5 tot 15 seconden.</span></span><button class="btn small ghost" data-act="stop-ai">Stop</button></div>`;
  } else if (L.mode === 'manual') {
    const m = L.manual;
    body = `<div class="card">
      ${mealSeg()}
      <label class="field">Wat heb je gegeten?<input id="m-name" value="${esc(m.name)}" placeholder="Bijv. appel"></label>
      <div class="grid2"><label class="field">kcal<input id="m-kcal" type="text" inputmode="decimal" autocomplete="off" value="${esc(m.kcal)}"></label>
      <label class="field">Eiwit (g)<input id="m-p" type="text" inputmode="decimal" autocomplete="off" value="${esc(m.p)}"></label>
      <label class="field">Koolhydraten (g)<input id="m-c" type="text" inputmode="decimal" autocomplete="off" value="${esc(m.c)}"></label>
      <label class="field">Vet (g)<input id="m-f" type="text" inputmode="decimal" autocomplete="off" value="${esc(m.f)}"></label>
      <label class="field">Waarvan verzadigd (g)<input id="m-sf" type="text" inputmode="decimal" autocomplete="off" placeholder="mag leeg" value="${esc(m.sf || '')}"></label></div>
      <button class="btn block" data-act="manual-save">Opslaan</button>
      <button class="add-line" data-mode="text">‹ Toch laten uitrekenen</button></div>`;
  } else {
    const favs = L.editId ? [] : S.meta.favs || [], rec = L.editId ? [] : recentFoods().filter(e => !isFav(e.name));
    L.lists = { fav: favs, rec, hist: L.lists.hist || [] };
    const chip = (e, key) => `<button data-quick="${key}" aria-label="${esc(e.name)} toevoegen"><span aria-hidden="true">${foodIcon(e)}</span><span class="rn"><b>${esc(e.name)}</b><span class="num note">${r0(key.startsWith('fav') ? itemsTotals(e.items.map(mkItem), e.mult || 1).kcal : e.kcal)} kcal</span></span><span class="add" aria-hidden="true">+</span></button>`;
    body = `
      ${mealSeg()}
      <div class="describe first">
        <label for="aiText" class="dq">${L.editId ? 'Wat at je?' : 'Wat heb je gegeten?'}</label>
        <textarea id="aiText" enterkeyhint="go" placeholder="Bijv. 2 volkoren boterhammen met kaas. Noem merk, hoeveelheid en bereiding.">${esc(L.text)}</textarea>
        <div id="matches">${matchesHTML(L.text)}</div>
        ${navigator.onLine === false ? `<button class="btn block" data-act="save-pending">⏳ Bewaar, later uitrekenen</button>
        <p class="note">Je bent offline. Zodra je weer internet hebt, rekent ${esc(S.meta.pet.name)} het vanzelf uit.</p>` : '<button class="btn block" data-act="analyze">Bereken calorieën</button>'}
      </div>
      ${L.editId ? '' : `<div class="pickers pkrow" aria-label="Of kies een andere manier">
        <button data-act="scan"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7V4h3M18 4h3v3M21 17v3h-3M6 20H3v-3M7 8v8M10 8v8M13 8v8M16.5 8v8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><b>Barcode</b></button>
        <button data-act="off-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15 15l5 5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><b>Zoeken</b></button>
        <button data-act="photo-mode"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/></svg><b>Foto</b></button></div>`}

      <div id="yestBox">${yesterdayHTML()}</div>
      ${favs.length ? `<div class="eyebrow">★ Favorieten</div><div class="recent">${favs.map((e, i) => chip(e, 'fav:' + i)).join('')}</div>` : ''}
      ${rec.length ? `<div class="eyebrow">Recent</div><div class="recent4">${rec.slice(0, 4).map((e, i) => chip(e, 'rec:' + i)).join('')}</div>` : ''}
      ${L.editId ? '<button class="btn block danger" data-act="del-entry">Verwijderen</button>' : ''}
      <button class="add-line" data-mode="manual" style="align-self:flex-start">Liever zelf invullen ›</button>`;
  }
  sheet(L.editId ? (R ? 'Bewerken' : 'Nog uitrekenen') : L.mode === 'manual' ? 'Zelf invullen' : L.mode === 'search' && !R ? 'Product zoeken' : R && R.src === 'recept' ? 'Recept · 1 portie' : 'Eten toevoegen', `
    ${L.error ? `<div class="err">${esc(L.error)}${L.errCode === 'label' ? ' <button class="add-line" data-act="label-photo">📷 Foto van het etiket</button> <button class="add-line" data-act="to-manual">Zelf invullen</button>' : L.errCode === 'no_key' || L.errCode === 'bad_key' ? ' <button class="add-line" data-act="goto-ai">Naar instellingen</button>' : L.errCode ? ' <button class="add-line" data-act="to-manual">Zelf invullen</button>' : ''}</div>
      ${LATER_CODES.includes(L.errCode) && !R ? `<button class="btn block ghost" data-act="save-pending">⏳ Bewaar en reken later uit</button>` : ''}` : ''}
    ${body}`, keep);
}
