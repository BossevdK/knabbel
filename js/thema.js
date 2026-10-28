/* Fasting notification, theme and flair. */
/* ---------- fasting notification: pinned countdown + a ping when it's done ---------- */
async function fastNotify(){
  const F = S.meta.fast; if (!Native || !F.start) return;
  try {
    await nat('notify.permission');
    const ok = await nat('fast.notify', { start: F.start, end: F.start + F.goal * 3.6e6, hours: F.goal });
    if (!ok) toast('Zet meldingen aan voor Knabbel om de aftelklok te zien.');
  } catch (e) {}
}

/* ---------- theme ---------- */
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
function applyTheme(){
  const t = S.meta.theme || 'system';
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const isDark = t === 'dark' || (t === 'system' && darkQuery.matches);
  if (Native) nat('app.theme', { dark: isDark }).catch(() => {});
  // The browser bar and the iPhone status bar: the system colours, or both set to your own choice.
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', t === 'system' ? m.dataset.c : isDark ? '#141A15' : '#FAEBDF'));
}
darkQuery.addEventListener?.('change', applyTheme);


/* ---------- flair ---------- */
const FLAIR = ['font', 'meal', 'glow', 'pet', 'moment', 'icons', 'alive'];
const FL = k => document.documentElement.classList.contains('fl-' + k);
FLAIR.forEach(k => document.documentElement.classList.add('fl-' + k));
const haptic = p => { if (FL('moment') && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} };
const timeOfDay = () => { const h = new Date().getHours(); return h >= 5 && h < 11 ? 'morning' : h < 17 && h >= 11 ? 'day' : h >= 17 && h < 22 ? 'evening' : 'night'; };
/* Own icons: one line style, two tones (the fill is the same colour, lighter). */
const FIC = {
  ontbijt: '<path d="M6.2 20.5v-8.6C4.6 11.3 3.6 9.9 3.6 8.3 3.6 5.4 7.4 3.5 12 3.5s8.4 1.9 8.4 4.8c0 1.6-1 3-2.6 3.6v8.6z" fill="currentColor" fill-opacity=".22"/><path d="M6.2 20.5v-8.6C4.6 11.3 3.6 9.9 3.6 8.3 3.6 5.4 7.4 3.5 12 3.5s8.4 1.9 8.4 4.8c0 1.6-1 3-2.6 3.6v8.6z"/><path d="M8.6 14.2c0-2.4 1.6-3.6 3.6-3.4 2.3.2 3.4 1.6 3.2 3.5-.2 1.8-1.7 2.9-3.6 2.8-1.9 0-3.2-1.1-3.2-2.9z"/><circle cx="12.1" cy="13.9" r="1.6" fill="currentColor"/>',
  lunch: '<path d="M4 15L12 4.5 20 15z" fill="currentColor" fill-opacity=".22"/><path d="M4 15L12 4.5 20 15zM4 15v3.5h16V15M8 15c1 1.2 2 1.2 3 0s2-1.2 3 0 2 1.2 3 0"/>',
  diner: '<circle cx="12.4" cy="12" r="4.8" fill="currentColor" fill-opacity=".22"/><circle cx="12.4" cy="12" r="4.8"/><circle cx="12.4" cy="12" r="2.2"/><path d="M2.8 4.5v3.6a1.5 1.5 0 0 0 3 0V4.5M4.3 9.6v9.9M21 10.6V19.5"/><path d="M21 4.5c-1.6.9-2.2 3.7-1.4 6.1H21z" fill="currentColor"/>',
  snack: '<path d="M12 7.5c-2.8-1.8-8-1-8 4.8 0 4.8 3.6 8.7 6 7.7 1-.4 3-.4 4 0 2.4 1 6-2.9 6-7.7 0-5.8-5.2-6.6-8-4.8z" fill="currentColor" fill-opacity=".22"/><path d="M12 7.5c-2.8-1.8-8-1-8 4.8 0 4.8 3.6 8.7 6 7.7 1-.4 3-.4 4 0 2.4 1 6-2.9 6-7.7 0-5.8-5.2-6.6-8-4.8zM12 7.5c0-2 .8-3.4 2.8-4.3"/>',
  water: '<path d="M12 3.2s-6.2 7-6.2 11.1a6.2 6.2 0 0 0 12.4 0C18.2 10.2 12 3.2 12 3.2z" fill="currentColor" fill-opacity=".22"/><path d="M12 3.2s-6.2 7-6.2 11.1a6.2 6.2 0 0 0 12.4 0C18.2 10.2 12 3.2 12 3.2zM9 14.5a3 3 0 0 0 3 3"/>',
  move: '<path d="M3 16.5h14.5a3.5 3.5 0 0 0 3.5-3.5c0-1.2-1.1-2.1-2.8-2.4l-4.7-.9-2-4.2H6.2z" fill="currentColor" fill-opacity=".22"/><path d="M3 16.5h14.5a3.5 3.5 0 0 0 3.5-3.5c0-1.2-1.1-2.1-2.8-2.4l-4.7-.9-2-4.2H6.2L3 16.5zM3 20h18M10 9.5l1.6-1.2M11.4 11.8l1.6-1.2"/>',
  fast: '<circle cx="12" cy="13" r="7.5" fill="currentColor" fill-opacity=".22"/><circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.6 2M9.5 2.8h5"/>'
};
const flIcon = k => FIC[k] ? `<svg class="fic fic-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FIC[k]}</svg>` : '';
/* Knabbel's head in the top bar of every page: asleep at night, happy when the day is on track, hungry when a meal is late. */
function miniPetHTML(){
  if (!FL('pet') || !S.profile) return '';
  const h = new Date().getHours(), mood = h >= 23 || h < 6 ? 'sleepy' : petMood();
  return `<button class="minipet m-${mood}" data-nav="pet" aria-label="Naar ${esc(S.meta.pet.name)}">${petSVG(mood, S.meta.pet.wear).replace('viewBox="0 0 200 200"', 'viewBox="22 14 156 136"')}</button>`;
}
/* The end of the day: a short look back, once a day, from 19:00 when dinner is in or the day is nearly full. */
function dayDoneHTML(k){
  if (!FL('moment') || k !== todayKey() || S.meta.dayDone === k) return '';
  const t = totals(k), B = budget(k), h = new Date().getHours();
  if (!(h >= 19 || window.__flairEvening) || !day(k).entries.length || !(mealDone(k, 'diner') || t.kcal >= B.kcal * 0.85)) return '';
  const DS = dayScore(k), okK = t.kcal <= B.kcal * 1.1 && t.kcal >= minKcal(), okP = t.p >= macroGoals(k).p * 0.9, okW = fluidMl(k) >= waterGoal(k), n = [okK, okP, okW].filter(Boolean).length;
  const chk = (ok, label, val) => `<span class="${ok ? 'ok' : ''}"><i aria-hidden="true">${ok ? '✓' : '–'}</i><span class="grow">${label}</span><b class="num">${val}</b></span>`;
  return `<section class="card daydone" aria-label="Dag afgerond">
    <div class="row between"><h3>✨ Dag afgerond</h3>${DS ? `<span class="score" style="${scoreStyle(DS.score)}">${DS.score}/10</span>` : ''}</div>
    <div class="checks">${chk(okK, 'Binnen je eetdoel', `${r0(t.kcal)} / ${B.kcal}`)}${chk(okP, 'Eiwit gehaald', `${r0(t.p)} g`)}${chk(okW, 'Genoeg gedronken', `${fluidMl(k)} ml`)}</div>
    <p class="muted">${n === 3 ? 'Een topdag! Ik ben trots op je.' : n === 2 ? 'Mooie dag. Morgen weer zo?' : 'Morgen is een nieuwe dag. Slaap lekker!'}</p>
    <button class="btn small" data-act="day-done" style="align-self:flex-start">Welterusten, ${esc(S.meta.pet.name)} 🌙</button></section>`;
}
/* A whole kilo towards your goal: a moment of its own, once per kilo. */
function kiloParty(force){
  if (!FL('moment') || !S.profile || sheetOpen()) return;
  const ws = weightSeries(); if (!ws.length) return;
  const lose = !isGain(S.profile.goal), got = lose ? startWeight() - ws[ws.length - 1].kg : ws[ws.length - 1].kg - startWeight();
  const whole = force || Math.floor(got + 1e-9);
  if (!force) { if (!(whole >= 1 && whole > (S.meta.kgParty || 0))) return; S.meta.kgParty = whole; save(); }
  setTimeout(() => {
    if (sheetOpen()) return;
    L = null; C = null;
    sheet('Hoera!', `<div class="kgparty"><div class="kgbig num">${lose ? '−' : '+'}${whole} kg</div>
      <p>Je bent <b>${whole} kilo ${lose ? 'lichter' : 'zwaarder'}</b> dan toen je begon. Dat is zo'n ${(whole * 7700).toLocaleString('nl-NL')} kcal die je ${lose ? 'minder at dan je verbruikte' : 'meer at dan je verbruikte'}.</p>
      ${petSVG('full', S.meta.pet.wear)}
      <button class="btn block" data-act="close">Yes! 🎉</button></div>`);
    confetti(40); haptic([30, 60, 30, 60, 80]);
  }, 500);
}
