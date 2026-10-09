/* Toasts and all taps and inputs (events). */
/* ---------- toast ---------- */
/* Each message pops up, stays a moment and fades out slowly; a new one lands on top of the pile.
   At most 3 at once. One with a button (undo) stays longer, and its button keeps its own action. */
let toastSeq = 0;
const toastFns = new Map();
function toast(msg, action){
  const root = $('#toastRoot');
  if ([...root.children].some(el => el.dataset.msg === msg && !el.classList.contains('out'))) return;
  const id = String(++toastSeq), life = action ? 6000 : 2800, el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status'); el.dataset.msg = msg; el.dataset.tid = id; el.style.setProperty('--life', life + 'ms');
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="toast-act" data-act="toast-act">${esc(action.label)}</button>` : ''}`;
  if (action) toastFns.set(id, action.fn);
  root.appendChild(el);
  const live = [...root.children].filter(x => !x.classList.contains('out'));
  live.slice(0, Math.max(0, live.length - 3)).forEach(dropToast);
  el._t = setTimeout(() => dropToast(el), life);
}
function dropToast(el){
  if (!el || el.classList.contains('out')) return;
  clearTimeout(el._t); el.classList.add('out'); toastFns.delete(el.dataset.tid);
  setTimeout(() => el.remove(), reduceMotion() ? 0 : 1000);
}

/* ---------- events ---------- */
async function connectHealth(){
  try {
    const st = await nat('health.status');
    if (st.sdk !== 'available') { healthStatus = st.sdk; render(); return; }
    const res = await nat('health.request');
    if (!res.granted || !res.granted.length) { toast('Geen toegang gekregen. Je kunt het later opnieuw proberen.'); return; }
    S.meta.health.on = true; healthStatus = null; healthMissing = false; S.meta.hcWeightsDay = null; retarget(); save();
    toast('Verbonden met Health Connect');
    await refreshHealth(Array.from({ length: 7 }, (_, i) => shiftKey(todayKey(), -i)));
    render();
  } catch (e) { toast('Verbinden mislukt: ' + e); }
}
/* Runs before the normal tap handling and looks at the result right after it: only the thing you tapped
   moves, so nothing replays when the page is drawn again for another reason. */
document.addEventListener('click', e => {
  if (reduceMotion() || !e.target.closest) return;
  const sum = e.target.closest('summary');
  if (sum) { const det = sum.parentElement; setTimeout(() => { if (det.open) { det.classList.add('opening'); setTimeout(() => det.classList.remove('opening'), 300); } }, 0); return; }
  const b = e.target.closest('button[aria-pressed]'); if (!b) return;
  const seg = b.closest('.seg'), segLabel = seg && seg.getAttribute('aria-label');
  const old = seg && seg.querySelector('[aria-pressed="true"]'), oldRect = old && old !== b ? old.getBoundingClientRect() : null;
  const sig = 'button' + [...b.attributes].filter(a => a.name.startsWith('data-')).map(a => `[${a.name}="${String(a.value).replace(/"/g, '\\"')}"]`).join('');
  setTimeout(() => {
    const nb = sig !== 'button' && document.querySelector(sig);
    if (nb && nb.getAttribute('aria-pressed') === 'true') { nb.classList.add('just'); setTimeout(() => nb.classList.remove('just'), 400); }
    if (!segLabel || !oldRect) return;
    const ns = document.querySelector(`.seg[aria-label="${segLabel}"]`), np = ns && ns.querySelector('[aria-pressed="true"]'); if (!np) return;
    const r = np.getBoundingClientRect(), dx = oldRect.left - r.left;
    if (Math.abs(dx) > 1 && r.width) np.animate([{ transform: `translateX(${dx}px) scaleX(${oldRect.width / r.width})` }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)', pseudoElement: '::before' });
  }, 0);
}, true);
document.addEventListener('click', e => {
  const bd = e.target.closest && e.target.closest('[data-barday]');
  if (bd) { dayKey = bd.dataset.barday; view = 'today'; window.scrollTo(0, 0); render(); refreshHealth([dayKey]); return; }
  const sn = e.target.closest && e.target.closest('[data-snap]');
  if (sn) { snapStore.load(sn.dataset.snap).then(txt => txt ? askRestore(txt) : toast('Dit herstelpunt is niet meer te lezen.')); return; }
  // The medal on an earned wardrobe item: says how it was won, without putting it on.
  const er = e.target.closest && e.target.closest('[data-earned]');
  if (er) { const it = SHOP.find(i => i.id === er.dataset.earned); if (it) toast(`🏅 ${it.name}. ${earnedText(it)}`); return; }
  const b = e.target.closest('button, [data-act="scrim"]'); if (!b) { ddClose(); return; }
  const d = b.dataset;
  if (b.classList.contains('ddb')) { ddToggle(b); return; }
  if (d.ddv !== undefined && b.closest('.dd')) { ddPick(b); return; }
  if (!b.closest('.dd')) ddClose();
  if (d.act === 'scrim') { if (e.target === b) closeSheet(); return; }
  if (d.wedit) { wEdit = d.wedit; weightsSheet(); return; }
  if (d.nav) { if (d.nav === 'profile' && view !== 'profile') prevView = view; view = d.nav; window.scrollTo(0, 0); render(); return; }
  if (d.sport) { W.min = ($('#wk-min') || {}).value ?? W.min; W.kcal = ($('#wk-kcal') || {}).value ?? W.kcal; W.label = ($('#wk-label') || {}).value ?? W.label; W.sport = d.sport; renderWorkout(); return; }
  if (d.delwork) {
    const dd = ensureDay(dayKey), i = (dd.workouts || []).findIndex(w => w.id === d.delwork); if (i < 0) return;
    const [gone] = dd.workouts.splice(i, 1); save(); render();
    toast('Sport verwijderd', { label: 'Ongedaan maken', fn: () => { dd.workouts.splice(i, 0, gone); save(); render(); } });
    return;
  }
  if (d.stepsfrom) {
    S.meta.health.stepsFrom = d.stepsfrom; applyStepsChoice(); retarget(); save(); render();
    // stay in the open steps panel
    const det = document.querySelector('details.stepsrc'); if (det) det.open = true;
    toast(`Knabbel telt nu ${d.stepsfrom === 'max' ? 'de app met de meeste stappen' : d.stepsfrom === 'hc' ? 'het Health Connect-totaal' : `de stappen van ${appName(d.stepsfrom)}`}`);
    return;
  }
  if (d.faston) { S.meta.fastOn = d.faston === '1'; if (S.meta.fastOn) openTile = 'fast'; save(); render(); toast(S.meta.fastOn ? 'Vasten staat nu op Vandaag.' : 'Vasten staat uit.'); return; }
  if (d.dailyact) { S.meta.dailyAct = Number(d.dailyact); retarget(); save(); render(); toast(`Eetdoel: ${S.profile.targets.kcal} kcal`); return; }
  if (d.manualmove) { S.meta.manualMove = d.manualmove === '1'; rebaseBurn(); retarget(); save(); render(); toast(S.meta.manualMove ? 'Je kunt nu sport toevoegen bij Beweging op Vandaag.' : 'Sporten zelf invullen staat uit.'); return; }
  if (d.remind) {
    S.meta.reminder = Object.assign({ time: '20:00' }, S.meta.reminder, { on: d.remind === '1' }); save(); syncReminder(); render();
    if (S.meta.reminder.on && Native) nat('notify.permission').catch(() => {});
    return;
  }
  if (d.nevopick != null) {
    const R = L && nevoResult(d.nevopick); if (!R) return;
    L.result = R; renderSheet(); return;
  }
  if (d.offpick != null) {
    const h = L && L.search.results[Number(d.offpick)]; if (!h) return;
    const R = productResult(h, h.code); if (!R) return;
    L.result = R; rememberProduct(h.code, R); save(); renderSheet(); return;
  }
  if (d.collapse) { const Lo = layout(); Lo.shut[d.collapse] = !Lo.shut[d.collapse]; S.meta.layout = Lo; save(); render();
    const sec = document.querySelector(`[data-collapse="${d.collapse}"]`); if (sec && !Lo.shut[d.collapse]) sec.parentElement.classList.add('reveal'); return; }
  if (d.lshut) { const Lo = layout(); Lo.shut[d.lshut] = !Lo.shut[d.lshut]; S.meta.layout = Lo; save(); render(); renderLayout(); return; }
  if (d.lmove) {
    const Lo = layout(), i = Lo.order.indexOf(d.lmove), j = i + Number(d.dir);
    if (j < 0 || j >= Lo.order.length) return;
    [Lo.order[i], Lo.order[j]] = [Lo.order[j], Lo.order[i]]; S.meta.layout = Lo; save(); render(); renderLayout(); return;
  }
  if (d.pettab) { petTab = d.pettab; window.scrollTo(0, 0); render(); return; }
  if (d.shopslot) {
    // Switched while far down the list: jump to the top of the new list, just under the tabs and the preview.
    const top = () => { const pv = document.querySelector('.shopsticky'), l = document.querySelector('.shopsticky + .card'); return pv && l ? l.getBoundingClientRect().top - pv.getBoundingClientRect().bottom - 10 : 0; };
    const deep = top() < 0;
    shopSlot = d.shopslot; render();
    if (deep) window.scrollTo(0, scrollY + top());
    return;
  }
  if (d.wrange) { wRange = d.wrange; wOff = 0; render(); return; }
  if (d.wview) { wView = d.wview; render(); return; }
  if (d.themeSet) { S.meta.theme = d.themeSet; save(); applyTheme(); render(); return; }
  if (d.sex) { $('#f-sex').value = d.sex; b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); updateTargetPreview(); return; }
  if (d.day) { const n = shiftKey(dayKey, Number(d.day)); if (n <= todayKey() && n >= minDay()) { dayKey = n; render(); refreshHealth([n]); } return; }
  if (d.water) {
    const fullBefore = document.querySelectorAll('.cup.full').length, rect = b.getBoundingClientRect(), from = fluidMl(dayKey);
    const dd = ensureDay(dayKey), before = dd.water || 0; dd.water = Math.max(0, before + Number(d.water));
    save();
    checkWaterGoal(dayKey);
    render(); popNewCups(fullBefore); if (Number(d.water) > 0) petEat('drink', '💧');
    if (dd.water !== before) waterFeedback(rect, dd.water - before, from);
    return;
  }
  if (d.edit) {
    const en = day(dayKey).entries.find(x => x.id === d.edit); if (!en) return;
    if (en.pending) { openLog({ meal: en.meal, editId: en.id, text: en.text || en.name }); return; }
    const items = (en.items?.length ? en.items : [{ name: en.name, qty: 1, unit: 'portie', unitPl: 'porties', kcal: en.kcal, p: en.p, c: en.c, f: en.f, sf: en.sf }]).map(mkItem);
    openLog({ meal: en.meal, editId: en.id, result: { title: en.name, icon: en.icon, items, mult: en.mult || 1, score: en.score, tip: en.tip, src: en.src, portions: en.portions, sources: en.sources } });
    return;
  }
  if (d.quick) {
    const [kind, i] = d.quick.split(':'); const src = (L.lists[kind] || [])[Number(i)]; if (!src) return;
    quickAdd([kind === 'fav' ? src : templateFrom(src)], L.meal); return;
  }
  if (d.mealSet) { L.meal = d.mealSet; b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); const yb = $('#yestBox'); if (yb) yb.innerHTML = yesterdayHTML(); return; }
  if (d.mode) { if (d.mode === 'manual' && !L.manual.name) L.manual.name = (($('#aiText') || {}).value || L.text || '').trim().slice(0, 60); else L.text = L.text || ''; L.mode = d.mode; L.error = ''; L.errCode = ''; renderSheet(); return; }
  if (d.delitem != null) { L.result.items.splice(Number(d.delitem), 1); renderSheet(); return; }
  if (d.mult) { L.result.mult = Number(d.mult); renderSheet(); return; }
  if (d.measure != null && L && L.result) { const it = L.result.items[0], m = measureList(L.result, it)[Number(d.measure)]; if (m) { setMeasure(it, m); L.result.mult = 1; renderSheet(); } return; }
  if (d.qty != null) { const it = L.result.items[Number(d.qty)]; setQty(it, stepQty(it, Number(d.dir))); renderSheet(); return; }
  if (d.ideafor) { S.meta.ideaFor = d.ideafor === 'auto' ? null : d.ideafor; A.extra = $('#advExtra')?.value || A.extra; save(); render(); return; }
  if (d.persons) { S.meta.ideaPersons = Number(d.persons); A.extra = $('#advExtra')?.value || A.extra; save(); render(); return; }
  if (d.qa) { askQA(d.qa); return; }
  if (d.pref) { A.prefs.has(d.pref) ? A.prefs.delete(d.pref) : A.prefs.add(d.pref); b.setAttribute('aria-pressed', A.prefs.has(d.pref)); return; }
  if (d.addidea != null) {
    const x = A.res.ideas[Number(d.addidea)]; dayKey = todayKey();
    // With ingredients you can adjust each one (in grams); otherwise the idea is one portion.
    const n = x.persons || 1, per = v => v == null ? v : v / n;   // the recipe is for n persons; you eat one portion
    const items = x.ingr.length && x.ingr.every(g => g.grams > 0)
      ? x.ingr.map(g => { const gr = Math.max(1, r0(g.grams / n)) /* at least 1 g: a pinch for 4 persons rounded to 0 */, ml = itemMl({ name: g.name, unit: 'g', grams: gr }); return mkItem({ name: g.name, qty: gr, unit: ml ? 'ml' : 'g', grams: gr, kcal: per(g.kcal), p: per(g.p), c: per(g.c), f: per(g.f), sf: per(g.sf), ml }); })
      : [mkItem({ name: x.portion ? `${x.name} (${x.portion})` : x.name, qty: 1, unit: 'portie', unitPl: 'porties', kcal: x.kcal, p: x.p, c: x.c, f: x.f, sf: x.sf })];
    const meal = x.type === 'Snack' ? 'snack' : A.res.meal && A.res.meal !== 'snack' ? A.res.meal : logMeal(todayKey());
    openLog({ meal, result: { title: x.name, items, mult: 1, src: 'advies', score: x.score || null, tip: '' } });
    return;
  }
  if (d.qopt != null && L?.result?.question) { const q = L.result.question; refineResult(`${q.text} Antwoord: ${q.options[Number(d.qopt)]}`); return; }
  if (d.ideaopen != null) { const i = Number(d.ideaopen); A.open = A.open === i ? null : i; if (ASK) renderAsk(); else render(); return; }
  if (d.fastgoal) { S.meta.fast.goal = Number(d.fastgoal); fastCustom = b.classList.contains('chip') && !FAST_PLANS.some(p => p[0] === S.meta.fast.goal); save(); render(); return; }
  if (d.fastfrom) { fastFrom = d.fastfrom; if (fastFrom === 'custom' && !fastTime) fastTime = hm(new Date(Date.now() - 3600e3)); render(); return; }
  if (d.shop) {
    const item = SHOP.find(i => i.id === d.shop), P = S.meta.pet;
    if (P.wear[item.slot] === item.id) P.wear[item.slot] = null;
    else if (P.owned.includes(item.id)) P.wear[item.slot] = item.id;
    else if (item.quest && !QUEST_DONE(item, questStats())) { const q = item.quest, have = Math.min(questStats()[q[0]] || 0, q[1]);
      toast(`🎮 ${item.name} (${item.game}): ${q[2]} Nu ${String(have).replace('.', ',')} van ${q[1]}.`); return; }
    else if (item.level && level(P.xp) < item.level) { toast(`${item.name} komt vrij op level ${item.level}${item.price ? ` (en kost dan ${item.price} zaadjes)` : ''}. Je bent nu level ${level(P.xp)}.`); return; }
    else if (P.seeds >= item.price) { P.seeds -= item.price; seedLog(-item.price, `Gekocht: ${item.name}`); P.owned.push(item.id); P.wear[item.slot] = item.id; toast(item.quest ? `🎮 Uitdaging gehaald: ${item.name} is van jou!` : item.level && !item.price ? `${item.name} is van jou!` : `${item.name} gekocht!`); confetti(); }
    else { toast(`Nog ${item.price - P.seeds} zaadjes nodig voor ${item.name.toLowerCase()}.`); return; }
    save(); refreshShop(); return;
  }
  switch (d.act) {
    case 'ring-mode': S.meta.ringMode = S.meta.ringMode === 'eaten' ? 'left' : 'eaten'; save(); render(); break;
    case 'water-add': {
      const inp = $('#waterMl'), ml = Math.round(Number(String(inp && inp.value || '').replace(',', '.')));
      if (!(ml >= 10 && ml <= 3000)) { toast('Vul een hoeveelheid in tussen 10 en 3000 ml.'); if (inp) inp.focus(); break; }
      const fullBefore = document.querySelectorAll('.cup.full').length, rect = b.getBoundingClientRect(), from = fluidMl(dayKey), dd = ensureDay(dayKey); dd.water = (dd.water || 0) + ml; save(); checkWaterGoal(dayKey); render(); popNewCups(fullBefore); petEat('drink', '💧'); waterFeedback(rect, ml, from); break;
    }
    case 'fast-custom': fastCustom = !fastCustom; render(); break;
    case 'tile': openTile = openTile === d.tile ? null : d.tile; render(); document.querySelector('.tilebody')?.classList.add('reveal'); break;
    case 'open-log': openLog({ meal: d.meal }); break;
    case 'open-workout': openWorkout(); break;
    case 'save-workout': saveWorkout(); break;
    case 'scan': scanBarcode(); break;
    case 'label-photo': labelPhoto(); break;
    case 'photo-mode': L.text = ($('#aiText') || {}).value ?? L.text; L.mode = 'photo'; L.error = ''; renderSheet(); break;
    case 'photo-take': photoAnalyze('take'); break;
    case 'photo-pick': photoAnalyze('pick'); break;
    case 'off-search': L.search.q = L.search.q || (($('#aiText') || {}).value || L.text || '').trim(); L.text = ($('#aiText') || {}).value ?? L.text; L.mode = 'search'; L.error = ''; renderSheet(); if (L.search.q && !L.search.results.length) searchProducts(); break;
    case 'off-go': searchProducts(); break;
    case 'pet-poke': {
      const pl = pokeLine();
      if (FL('alive')) { const now = Date.now(); pokeTaps = pokeTaps.filter(t => now - t < 1400).concat(now);
        replay(b, pokeTaps.length >= 3 ? 'dance' : pl.spin || Math.random() < .25 ? 'jump' : 'giggle'); if (pokeTaps.length >= 3) pokeTaps = [];
        setTimeout(() => ['dance', 'jump', 'giggle'].forEach(c => b.classList.remove(c)), 2000); }
      else { replay(b, pl.spin || Math.random() < .3 ? 'spin' : 'hop'); replay(b, 'wag'); }
      if (!reduceMotion()) { const h = document.createElement('span'); h.className = 'poke-heart'; h.textContent = ['❤️', '💛', '🧡', '✨'][Math.floor(Math.random() * 4)]; h.style.setProperty('--dx', Math.round((Math.random() - .5) * 60) + 'px'); b.appendChild(h); setTimeout(() => h.remove(), 1000); }
      const bub = $('#petBubble'); if (bub) bub.textContent = pl.text;
      break;
    }
    case 'seed-history': L = null; C = null; sheet('Je zaadjes', seedHistoryHTML()); break;
    case 'goto-shop': closeSheet(); view = 'pet'; petTab = 'shop'; window.scrollTo(0, 0); render(); break;
    case 'close': closeSheet(); render(); break;
    case 'analyze': analyze(); break;
    case 'advise-fridge': adviseFridge(); break;
    case 'edit-layout': openLayout(); break;
    case 'layout-reset': S.meta.layout = null; save(); render(); renderLayout(); break;
    case 'ask-knabbel': openAsk(); break;
    case 'fit-ask': askFit(); break;
    case 'qa-ask': askQA(); break;
    case 'qa-stop': QA.token++; QA.busy = false; { const x = QA.list.pop(); if (x) QA.text = x.q; } render(); break;
    case 'qa-clear': QA = { text: '', busy: false, error: '', list: [], token: QA.token + 1 }; render(); break;
    case 'fit-log': { const R = FIT.res; if (!R) break; const frac = Number(d.frac) || 1; FIT.open = false; dayKey = todayKey();
      const fm = fitVerdict(R).meal;
      // In grams when the weight is known ("150 g"), not "½ portion": the amount can then be set exactly.
      const g = frac === 1 ? r0(R.grams) : Math.max(5, r0(R.grams * frac / 5) * 5), ml = /\bml\b/i.test(R.portion || '') || (DRINK_RE.test(foldText(R.name)) && !NOT_DRINK.test(foldText(R.name)));
      const item = R.grams > 0 ? mkItem({ name: R.name, qty: g, unit: ml ? 'ml' : 'g', grams: g, kcal: R.kcal * g / R.grams, p: R.p * g / R.grams, c: R.c * g / R.grams, f: R.f * g / R.grams, sf: R.sf == null ? null : R.sf * g / R.grams }) : fitItem(R);
      openLog({ ...(fm ? { meal: fm } : {}), result: { title: R.name, items: [item], mult: R.grams > 0 ? 1 : frac, src: 'ai', score: R.score || null, tip: '' } }); break; }
    case 'fit-ideas': { const txt = FIT.text; FIT.open = false; L = null; C = null; W = null; ASK = true; A.extra = `iets dat lijkt op ${txt}, maar dan lichter of een kleinere portie`; renderAsk(); advise(); break; }
    case 'goto-advice': closeSheet(); view = 'advice'; window.scrollTo(0, 0); render(); break;
    case 'toggle-partial': { const dd = ensureDay(dayKey); dd.flags.partial = !dd.flags.partial; dd.flags.partialAsked = true; save(); render(); toast(dd.flags.partial ? 'Deze dag telt niet mee in je gemiddelden.' : 'Deze dag telt weer mee.'); break; }
    case 'partial-yes': { const dd = ensureDay(shiftKey(todayKey(), -1)); dd.flags.partial = true; dd.flags.partialAsked = true; save(); render(); toast('Gisteren telt niet mee in je gemiddelden.'); break; }
    case 'partial-no': { const dd = ensureDay(shiftKey(todayKey(), -1)); dd.flags.partialAsked = true; save(); render(); break; }
    case 'rate-fix': S.profile.rate = safeRate(S.profile.weight); retarget(); save(); render(); toast(`Tempo ${rateStr(S.profile.rate)} kg per week. Eetdoel: ${S.profile.targets.kcal} kcal`); break;
    case 'rate-later': S.meta.rateWarnUntil = shiftKey(todayKey(), 14); save(); render(); break;
    case 'low-later': S.meta.lowWarnUntil = shiftKey(todayKey(), 3); save(); render(); break;
    case 'tip-hide': S.meta.tipHidden = todayKey(); save(); render(); break;
    case 'q-skip': if (L?.result) { L.result.question = null; renderSheet(); } break;
    case 'ai-fix': { const v = (($('#fixText') || {}).value || '').trim(); if (!v) { toast('Typ eerst wat er niet klopt.'); break; } refineResult(v); break; }
    case 'ai-fresh': if (L) { L.result = null; analyze(true); } break;
    case 'save-pending': savePending(); break;
    case 'stop-ai': if (L) { L.token++; L.busy = false; L.shot = ''; renderSheet(); } break;
    case 'reset-log': openLog({ meal: L.meal, text: L.text, day: L.day }); break;
    case 'to-manual': { const name = (L.text || '').trim().slice(0, 60); L.mode = 'manual'; L.error = ''; L.errCode = ''; L.manual.name = name; renderSheet(); break; }
    case 'manual-save': {
      const g = id => $('#m-' + id).value; const name = g('name').trim();
      L.manual = { name, kcal: g('kcal'), p: g('p'), c: g('c'), f: g('f'), sf: g('sf') };
      if (!name || !num(g('kcal'))) { L.error = 'Vul minstens een naam en kcal in.'; renderSheet(); break; }
      if (num(g('kcal')) > 2000 && L.bigOk !== num(g('kcal'))) { L.bigOk = num(g('kcal')); L.error = `${r0(num(g('kcal')))} kcal is veel voor één keer. Klopt het? Tik nog een keer op Opslaan.`; renderSheet(); break; }
      const mk = 4 * num(g('p')) + 4 * num(g('c')) + 9 * num(g('f'));
      if (mk > num(g('kcal')) * 1.3 + 20 && L.macroOk !== mk) { L.macroOk = mk; L.error = `Eiwit, koolhydraten en vet samen zijn al ± ${r0(mk)} kcal, meer dan de ${r0(num(g('kcal')))} kcal die je invulde. Klopt het? Tik nog een keer op Opslaan.`; renderSheet(); break; }
      const it = mkItem({ name, qty: 1, unit: 'portie', unitPl: 'porties', kcal: num(g('kcal')), p: num(g('p')), c: num(g('c')), f: num(g('f')), sf: g('sf').trim() ? num(g('sf')) : null });
      L.error = ''; L.result = { title: name, items: [it], mult: 1, src: 'manual' }; saveEntry(); break;
    }
    case 'save-entry': saveEntry(); break;
    case 'del-entry': {
      const dd = ensureDay(L.day), idx = dd.entries.findIndex(x => x.id === L.editId); if (idx < 0) break;
      const [gone] = dd.entries.splice(idx, 1); save(); closeSheet(); collapseThen([gone.id], render);
      toast(`${gone.name} verwijderd`, { label: 'Ongedaan maken', fn: () => { dd.entries.splice(Math.min(idx, dd.entries.length), 0, gone); save(); flash(gone.id); render(); } });
      break;
    }
    case 'toast-act': { const el = b.closest('.toast'), fn = el && toastFns.get(el.dataset.tid); dropToast(el); if (fn) fn(); break; }
    case 'fav-toggle': {
      const R = L.result; R.title = ($('#r-title') || {}).value || R.title;
      const favs = S.meta.favs || [], k = favKey(R.title);
      if (isFav(R.title)) S.meta.favs = favs.filter(f => favKey(f.name) !== k);
      else S.meta.favs = [templateFrom({ ...R, name: R.title }), ...favs].slice(0, 20);
      save(); renderSheet(); toast(isFav(R.title) ? '★ Bewaard als favoriet' : 'Uit favorieten gehaald'); break;
    }
    case 'copy-yesterday': {
      const y = yesterdayMeal();
      if (y.length) quickAdd(y.map(templateFrom), L.meal); break;
    }
    case 'advise': advise(); break;
    case 'stop-adv': A.token++; A.busy = false; render(); break;
    case 'fast-start': S.meta.fast.start = fastStartTs(); fastFrom = 'now'; save(); render(); fastNotify(); break;
    case 'fast-stop': stopFast(); render(); break;
    case 'open-checkin': openCheckin(); break;
    case 'ci-toggle': ciAll = !ciAll; render(); break;
    case 'weights-open': L = null; C = null; wEdit = null; weightsSheet(); break;
    case 'apple-paste': pasteApple(); break;
    case 'apple-apply': { const v = parseApple(($('#appleTxt') || {}).value); if (v) applyApple(v); else toast('Daar staan geen stappen, kcal of gewicht in.'); break; }
    case 'apple-off': S.meta.apple = { on: false }; rebaseBurn(); retarget(); save(); render(); toast('Apple Health staat uit'); break;
    case 'w-del': {
      const dt = d.date, w = S.meta.weights.find(x => x.date === dt); if (!w) break;
      if (S.meta.weights.length <= 1) { toast('Je laatste weging kun je niet verwijderen. Pas hem aan.'); break; }
      S.meta.weights = S.meta.weights.filter(x => x.date !== dt); afterWeightsChange(); wEdit = null; weightsSheet();
      toast(`Weging van ${prettyDay(dt).toLowerCase()} verwijderd`, { label: 'Ongedaan maken', fn: () => { S.meta.weights = S.meta.weights.concat(w); afterWeightsChange(); if (sheetOpen()) weightsSheet(); } });
      break;
    }
    case 'explain-xp': L = null; C = null; sheet('Level en xp', xpHTML()); break;
    case 'explain-dayscore': L = null; C = null; sheet('Je dagscore', dayScoreHTML(dayKey)); break;
    case 'explain-goal': L = null; C = null; sheet('Je eetdoel uitgelegd', goalExplainHTML()); break;
    case 'explain-macros': L = null; C = null; macroSheet(dayKey, 'sf'); break;
    case 'macro-src': L = null; C = null; macroSheet(dayKey, d.m || 'p'); break;
    case 'explain-forecast': L = null; C = null; sheet('Wanneer haal je je streefgewicht?', forecastHTML()); break;
    case 'score-now': scoreNow(); break;
    case 'w-prev': wOff++; render(); break;
    case 'w-next': wOff = Math.max(0, wOff - 1); render(); break;
    case 'w-today': wOff = 0; render(); break;
    case 'relook': {   // look the estimated items up again (after the search pause)
      const R = L && L.result; if (!R) break;
      if (S.meta.ai.searchCool > Date.now()) { toast(`Opzoeken kan weer om ${new Date(S.meta.ai.searchCool).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}.`); break; }
      R.looking = webTodo(R).map(i => i.name); if (!R.looking.length) { delete R.looking; break; }
      renderSheet();
      webFill(R).catch(() => {}).finally(() => { delete R.looking; if (L && L.result === R) { if (L.cacheText && R.src === 'ai') cachePut(L.cacheText, R); save(); renderSheet(); } });
      break;
    }
    case 'day-done': S.meta.dayDone = todayKey(); save(); haptic([15, 40, 15]); confetti(18); render(); break;
    case 'explain-trend': L = null; C = null; sheet('Wat is de trend?', trendExplainHTML()); break;
    case 'goto-profile': closeSheet(); if (view !== 'profile') prevView = view; view = 'profile'; render(); window.scrollTo(0, 0); break;
    case 'ci-later': S.meta.checkinSnooze = todayKey(); save(); closeSheet(); toast('Ik herinner je morgen weer.'); render(); break;
    case 'ci-save': {
      const kg = r1(num($('#ci-kg').value)); if (!kg || kg < 30 || kg > 300) { toast('Vul een gewicht tussen 30 en 300 kg in.'); break; }
      completeCheckin(kg, C.week);
      break;
    }
    case 'ci-adjust': {
      const a = C.result.action; S.profile.adjust = a.setAdj != null ? a.setAdj : clamp((S.profile.adjust || 0) + a.adj, -500, 500); retarget(); save();
      C.result.applied = true; renderCheckin(); break;
    }
    case 'goto-ai': closeSheet(); view = 'settings'; setOpen.add('AI voor calorieën'); render(); setTimeout(() => document.getElementById('ai')?.scrollIntoView({ behavior: 'smooth' }), 50); break;
    case 'open-aistudio': openUrl('https://aistudio.google.com/apikey'); break;
    case 'ai-save': {
      S.meta.ai.key = $('#ai-key').value.trim(); S.meta.ai.model = $('#ai-model').value;
      const prefs = ($('#ai-prefs')?.value || '').trim().slice(0, 600);
      if (prefs !== (S.meta.aiPrefs || '')) { S.meta.aiPrefs = prefs; S.meta.aiCache = {}; }  // remembered answers were made without these
      save(); toast('AI-instellingen opgeslagen'); render(); break;
    }
    case 'ai-test': {
      S.meta.ai.key = $('#ai-key').value.trim(); S.meta.ai.model = $('#ai-model').value; save();
      const out = $('#aiTestOut'); out.innerHTML = '<div class="thinking"><span class="dots"><i></i><i></i><i></i></span>Even testen…</div>';
      // Only the list of models: free, so testing doesn't use any of your daily AI questions.
      modelList(S.meta.ai.key, true)
        .then(ms => { render(); const best = rankModels((ms || []).map(n => ({ name: 'models/' + n, supportedGenerationMethods: ['generateContent'] })))[0] || ms[0];
          $('#aiTestOut').innerHTML = `<div class="ok">Het werkt! Je sleutel heeft ${ms.length} ${ms.length === 1 ? 'model' : 'modellen'}${best ? `, waaronder ${esc(best)}` : ''}. Testen kost geen AI-vraag.</div>`; })
        .catch(err => { $('#aiTestOut').innerHTML = `<div class="err">${esc(errCopy(err))}</div>`; });
      break;
    }
    case 'hc-connect': connectHealth(); break;
    case 'hc-install': openUrl('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata'); break;
    case 'hc-refresh': refreshHealth(Array.from({ length: 7 }, (_, i) => shiftKey(todayKey(), -i))).then(() => toast('Beweging bijgewerkt')); break;
    case 'hc-off': S.meta.health.on = false; rebaseBurn(); retarget(); save(); render(); toast('Health Connect losgekoppeld'); break;
    case 'backup-save': saveBackup(); break;
    case 'share-web': shareWeb(); break;
    case 'backup-open':
      if (Native) nat('backup.open').then(txt => { if (txt) askRestore(txt); }).catch(() => toast('Openen lukte niet.'));
      else $('#restoreFile')?.click();
      break;
    case 'backup-restore': {
      const j = pendingRestore; if (!j) break;
      const before = backupData();
      restoreData(j.data); pendingRestore = null; closeSheet();
      // Changed your mind: one tap puts back what was there just before.
      toast('Back-up teruggezet', { label: 'Ongedaan maken', fn: () => { restoreData(JSON.parse(before).data); toast('Terug zoals het was'); } });
      break;
    }
    case 'update-check': checkUpdate(true); break;
    case 'web-update': checkWebUpdate(true).then(() => { if (webNew) location.reload(); else { toast('Je hebt de nieuwste versie.'); render(); } }); break;
    case 'update-install': installUpdate(); break;
    case 'update-later': S.meta.updLaterUntil = Date.now() + 3 * 864e5; save(); render(); break;
    case 'backup-later': S.meta.backupNudgeUntil = shiftKey(todayKey(), 7); save(); render(); break;
    case 'tech-share': shareTechInfo(); break;
    case 'auto-pick':
      nat('autobackup.pick').then(r => {
        if (!r || !r.uri) return;
        const old = S.meta.autoBackup && S.meta.autoBackup.uri;
        if (old && old !== r.uri) nat('autobackup.forget', { uri: old }).catch(() => {});
        S.meta.autoBackup = { uri: r.uri, name: r.name || 'gekozen map', at: 0, err: '' }; save(true);
        autoBackupNow().then(() => { render(); toast(S.meta.autoBackup.err ? 'Schrijven in die map lukte niet.' : 'Automatische back-up staat aan'); });
      }).catch(() => toast('Kiezen lukte niet.'));
      break;
    case 'auto-off':
      if (S.meta.autoBackup) nat('autobackup.forget', { uri: S.meta.autoBackup.uri }).catch(() => {});
      delete S.meta.autoBackup; clearTimeout(autoT); autoT = null; save(); render(); toast('Automatische back-up staat uit');
      break;
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'fitText' || t.id === 'qaText') warmAI();
  if (t.id === 'aiText') prefetchSoon();
  if (t.dataset.mass != null && L?.result) {
    const i = Number(t.dataset.mass), it = L.result.items[i]; setQty(it, num(t.value));
    const mc = document.querySelector(`[data-mc="${i}"]`); if (mc) mc.textContent = `${r0(it.kcal)} kcal`;
    const tt = itemsTotals(L.result.items, L.result.mult || 1);
    $('#sumBox').outerHTML = sumHTML(tt);
    const sb = $('#saveBtn'); if (sb) sb.textContent = `Opslaan · ${r0(tt.kcal)} kcal`;
    const mb = $('#mlBox'); if (mb) mb.textContent = mlLine(L.result);
  }
  if (t.id === 'r-title' && L?.result) L.result.title = t.value;
  if (t.id === 'aiText' && L) { L.text = t.value; const m = $('#matches'); if (m) m.innerHTML = matchesHTML(t.value); }
  if (t.id === 'advExtra') A.extra = t.value;
  if (t.id === 'offQ' && L) { L.search.q = t.value; const box = $('#nevoRes'); if (box) box.innerHTML = nevoResHTML(t.value); }
  if (t.id === 'fitText') FIT.text = t.value;
  if (t.id === 'qaText') QA.text = t.value;
  if (W && t.id === 'wk-min' && W.sport !== 'anders') { const sp = SPORTS.find(x => x[0] === W.sport), pv = $('#wk-prev'); if (pv) pv.textContent = r0(workoutKcal({ met: sp[2], min: num(t.value) }).kcal); }
  if (t.closest('#profileForm')) updateTargetPreview();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'fast-time') { fastTime = t.value; render(); }
  if (t.id === 'remind-time' && t.value) { S.meta.reminder.time = t.value; save(); syncReminder(); toast(`Herinnering om ${t.value}`); }
  if (t.id === 'restoreFile' && t.files && t.files[0]) t.files[0].text().then(askRestore);
  if (t.id === 'hc-pct') { S.meta.health.pct = Number(t.value); save(); toast('Opgeslagen'); }
  if (t.closest('#profileForm')) updateTargetPreview();
});
document.addEventListener('keydown', e => {
  if (e.target.id === 'fitText' && e.key === 'Enter') { e.preventDefault(); e.target.blur(); askFit(); return; }
  if (e.target.id === 'qaText' && e.key === 'Enter') { e.preventDefault(); e.target.blur(); askQA(); return; }
  if (e.target.id === 'fixText' && e.key === 'Enter') { e.preventDefault(); const v = e.target.value.trim(); if (v) refineResult(v); return; }
  if (e.target.id === 'offQ' && e.key === 'Enter') { e.preventDefault(); e.target.blur(); searchProducts(); }
  if (e.target.id === 'aiText' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.target.blur(); analyze(); }
});
document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'profileForm') {
    const p = readProfileForm();
    if (!p.age || !p.height || !p.weight) { toast('Vul leeftijd, lengte en gewicht in.'); return; }
    if (p.weight < 30 || p.weight > 300) { toast('Vul een gewicht tussen 30 en 300 kg in.'); return; }
    if (p.age < 14 || p.age > 100) { toast('Vul een leeftijd tussen 14 en 100 jaar in.'); return; }
    if (p.height < 120 || p.height > 230) { toast('Vul een lengte tussen 120 en 230 cm in.'); return; }
    if (p.goal === 'lose' && p.age < 18) { toast('Onder de 18 is afvallen met minder eten niet verstandig zonder je huisarts of een diëtist. Kies "Op gewicht blijven".'); return; }
    if (p.goal === 'lose' && p.goalWeight && p.goalWeight >= p.weight) { toast('Je streefgewicht ligt niet onder je huidige gewicht. Kies een lager streefgewicht of een ander doel.'); return; }
    if (isGain(p.goal) && p.goalWeight && p.goalWeight <= p.weight) { toast('Je streefgewicht ligt niet boven je huidige gewicht. Kies een hoger streefgewicht of een ander doel.'); return; }
    const h2 = (p.height / 100) ** 2;
    if (p.goal === 'lose' && p.goalWeight && p.goalWeight / h2 < 18.5) { toast(`Kies een streefgewicht van minimaal ${Math.ceil(18.5 * h2)} kg.`); return; }
    if (p.goal === 'lose' && p.weight / h2 < 18.5) { toast('Met ondergewicht kun je geen afvaldoel kiezen. Kies "Op gewicht blijven".'); return; }
    const first = !S.profile;
    S.profile = p; retarget();
    const tk = todayKey();
    // A new weight here is today's weight too, so the chart and the forecast know it.
    const lastW = weightSeries().slice(-1)[0];
    if (first || !lastW || Math.abs(lastW.kg - p.weight) >= 0.05) S.meta.weights = S.meta.weights.filter(w => w.date !== tk).concat({ date: tk, kg: p.weight });
    save(); view = first ? 'today' : prevView; render(); window.scrollTo(0, 0);
    const bub = first && $('#petBubble');
    if (bub) bub.textContent = `Welkom! Je mag vandaag ${p.targets.kcal} kcal eten. Log je eerste hapje, dan word ik blij.`;
    else toast(first ? `Welkom! Je eetdoel is ${p.targets.kcal} kcal.` : `Opgeslagen. Je eetdoel is ${p.targets.kcal} kcal.`);
  }
  if (e.target.id === 'petNameForm') {
    const pn = $('#f-petname').value.trim();
    if (!pn) { toast('Geef je panda een naam.'); return; }
    S.meta.pet.name = pn.slice(0, 16); save(); render(); toast(`Je panda heet nu ${S.meta.pet.name}`);
  }
  if (e.target.id === 'wEditForm') {
    const kg = r1(num($('#we-kg').value)); if (!kg || kg < 30 || kg > 300) { toast('Vul een gewicht tussen 30 en 300 kg in.'); return; }
    const dt = e.target.dataset.date, w = S.meta.weights.find(x => x.date === dt); if (!w) return;
    const old = w.kg; w.kg = kg; afterWeightsChange(); wEdit = null; weightsSheet();
    toast(`${prettyDay(dt)}: ${kgStr(kg)} kg`, { label: 'Ongedaan maken', fn: () => { const x = S.meta.weights.find(y => y.date === dt); if (x) { x.kg = old; afterWeightsChange(); if (sheetOpen()) weightsSheet(); } } });
    return;
  }
  if (e.target.id === 'weightForm') {
    const kg = r1(num($('#w-kg').value)); if (!kg || kg < 30 || kg > 300) { toast('Vul een gewicht tussen 30 en 300 kg in.'); return; }
    const tk = todayKey();
    S.meta.weights = S.meta.weights.filter(w => w.date !== tk).concat({ date: tk, kg });
    S.profile.weight = kg; retarget(); updateBurn(); save(); render();
    // A weigh-in is due: this weighing is it. The weigh-in result (on schedule or not) shows, and the card goes away.
    const due = dueWeek(); if (due) { L = null; C = { week: due, kg, hc: null, result: null }; completeCheckin(kg, due); return; }
    const why = scaleWhy(); toast(why ? `Gewicht opgeslagen. ${why.delta > 0 ? '+' : '−'}${kgStr(Math.abs(why.delta))} kg: ${why.head.toLowerCase().replace(/[.!]$/, '')}. Kijk bij "Waarom?"` : `Gewicht opgeslagen. Eetdoel: ${S.profile.targets.kcal} kcal`);
  }
});
/* Keyboard open: the tab bar would sit on top of it. */
const typingField = t => t && t.matches && t.matches('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea, select');
document.addEventListener('focusin', e => { if (typingField(e.target)) document.body.classList.add('typing'); });
document.addEventListener('focusout', e => { if (typingField(e.target)) setTimeout(() => { if (!typingField(document.activeElement)) document.body.classList.remove('typing'); }, 60); });
window.onNativeBack = () => {
  if (sheetOpen()) { closeSheet(); render(); return true; }
  if (view === 'profile' && prevView !== 'profile') { view = prevView; window.scrollTo(0, 0); render(); return true; }
  if (view !== 'today') { view = 'today'; window.scrollTo(0, 0); render(); return true; }
  if (dayKey !== todayKey()) { dayKey = todayKey(); render(); return true; }
  return false;
};
let lastResumeDay = todayKey();
window.onNativeResume = () => {
  settleGoals();
  updateBurn();
  if (lastResumeDay !== todayKey()) { lastResumeDay = todayKey(); dayKey = todayKey(); if (!sheetOpen()) render(); }
  refreshHealth([todayKey(), shiftKey(todayKey(), -1)]);   // yesterday too: the steps after the last time you opened the app
  scheduleReminder();
  maybePromptCheckin();
  setTimeout(processPending, 1500);
  setTimeout(lookLater, 5000);
  checkUpdate();
};
setTimeout(checkShare, 600);
if (!Native && isIOS() && !standalone() && !S.meta.iosHint) setTimeout(() => { S.meta.iosHint = 1; save(); toast('Tip: tik op Deel en kies "Zet op beginscherm". Dan werkt Knabbel als een app.'); }, 4000);
setTimeout(settleGoals, 2500);
function maybePromptCheckin(){
  if (!S.profile || sheetOpen()) return;
  const h = new Date().getHours();
  if (h >= 6 && h < 12 && dueWeek() && S.meta.checkinSnooze !== todayKey()) openCheckin();
}
let hcReadAt = 0;
setInterval(() => {
  tickFast(); checkGoalToday();
  // Steps keep coming in from your phone or watch: read them again every 5 minutes while Knabbel is open.
  if (Native && S.meta.health.on && !document.hidden && Date.now() - hcReadAt > 300000) { hcReadAt = Date.now(); refreshHealth([todayKey()]); }
  if (lastResumeDay !== todayKey()) { lastResumeDay = todayKey(); if (dayKey === shiftKey(todayKey(), -1)) dayKey = todayKey(); if (Native && S.meta.health.on) refreshHealth([todayKey(), shiftKey(todayKey(), -1)]); if (!sheetOpen()) render(); }
}, 30000);

