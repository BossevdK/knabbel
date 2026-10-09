/* Targets: eat goal, move goal, movement (Health Connect) and the weekly check-in. */
/* ---------- targets ---------- */
const ACT = [[1.2,'Vooral zittend'],[1.375,'Licht actief (1–3× sporten)'],[1.55,'Actief (3–5× sporten)'],[1.725,'Zeer actief (6–7× sporten)'],[1.9,'Zwaar werk + sport']];
/* Movement is tracked per day (Health Connect and/or workouts you enter): the eat goal then starts from a
   sitting day and every day gets its own bonus. Otherwise the activity level from your profile is used. */
/* iPhone: movement from Apple Health, pasted from a Shortcut (see appleHTML). Measures all your movement, like Health Connect. */
const appleOn = () => !Native && !!(S.meta.apple && S.meta.apple.on);
const measuredMove = () => !!(S.meta.health.on || appleOn());
const moveOn = () => !!(measuredMove() || S.meta.manualMove);
/* Gaining weight: "Aankomen" and "Spieropbouw" both go up; muscle with a smaller surplus and more protein. */
function isGain(g){ return g === 'gain' || g === 'muscle'; }
const GOAL_NAME = { lose: 'afvallen', maintain: 'op gewicht blijven', gain: 'aankomen', muscle: 'spieropbouw (met krachttraining, klein overschot)' };
function calcTargets(p){
  // Health Connect / Apple Health measure all your movement; logging sport yourself adds only the sport, on top of your daily life.
  const activity = measuredMove() ? 1.2 : S.meta.manualMove ? (S.meta.dailyAct || 1.2) : p.activity;
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'm' ? 5 : -161);
  const tdeeF = bmr * activity;
  // Measured burn (from what you ate and how your weight moved, see updateBurn) replaces the formula once it is known.
  const B = p.burn && p.burn.base > 0 ? p.burn : null;
  const tdee = B ? B.base : tdeeF, ratio = B ? clamp(tdee / tdeeF, 0.8, 1.2) : 1;
  // Gaining: 300 kcal a day extra. Building muscle: a smaller surplus (200), so most of what you gain is muscle and
  // not fat; that only works together with strength training (said in the profile form).
  const surplus = p.goal === 'gain' ? 300 : p.goal === 'muscle' ? 200 : 0;
  const change = p.goal === 'lose' ? -(p.rate * 7700) / 7 : surplus;
  const raw = tdee + change + (p.adjust || 0);
  // Personal minimum: 80% of what you burn at rest, never below 1200 kcal (men 1500). With a measured burn the rest
  // burn is scaled the same way (burning 8% less than the formula: resting 8% less too), and you never eat more than
  // 25% under your real burn.
  const fAbs = p.sex === 'm' ? 1500 : 1200, fRest = Math.round(bmr * ratio * 0.8 / 10) * 10, fPct = B ? Math.round(tdee * 0.75 / 10) * 10 : 0;
  const floor = Math.max(fAbs, fRest, fPct), floorWhy = floor === fPct ? 'pct' : floor === fRest ? 'rest' : 'abs';
  const kcal = Math.max(floor, Math.round(raw / 10) * 10);
  // The minimum can make the chosen pace impossible; the schedule then follows the pace you can really reach.
  const planned = Math.max(floor, tdee + change);
  const effRate = p.goal === 'lose' ? Math.min(p.rate, Math.max(0, (tdee - planned) * 7 / 7700)) : p.goal === 'gain' ? 0.25 : p.goal === 'muscle' ? 0.2 : 0;
  // Protein per kg of a healthy reference weight: today's weight, but never above a BMI-25 weight. Before, a goal
  // weight that was itself far above a healthy weight counted (150 cm, 120 → 115 kg gave 207 g, half the calories).
  const refW = Math.min(p.weight, 25 * (p.height / 100) ** 2);
  // Building muscle: 2 g per kg (the usual advice is 1.6 to 2.2 g with strength training).
  const perKg = p.goal === 'muscle' ? 2 : p.goal === 'lose' ? 1.8 : 1.6;
  // Never more than 35% of the calories from protein (the upper end of the usual advice).
  const protein = Math.min(Math.round(refW * perKg), Math.floor(kcal * 0.35 / 4));
  const R = macroRange(kcal, protein);
  return { kcal, p: protein, c: R.cMax, f: R.fMax, fMin: R.fMin, sfMax: R.sfMax, bmr: Math.round(bmr), bmrReal: Math.round(bmr * ratio), tdee: Math.round(tdee), tdeeF: Math.round(tdeeF), measured: !!B, floorWhy, change: Math.round(change), raw: Math.round(raw), floor, floored: kcal === floor && raw < floor, fAbs, fRest, fPct,
           effRate: Math.round(effRate * 100) / 100, refW: Math.round(refW), perKg };
}
function retarget(){ if (S.profile) S.profile.targets = calcTargets({ ...S.profile, weight: calcWeight() }); }
/* The weight the formulas use: your trend when you weigh often enough, otherwise your last weight. */
const calcWeight = () => { const t = trendNow(); return t != null ? Math.round(t * 10) / 10 : S.profile.weight; };
/* Fat is a range: 20 to 35% of the kcal (Gezondheidsraad and the usual advice agree on that), saturated fat at most 10%.
   Carbs get what is left after protein and fat, but never less than 50 g; on a very low eat goal the fat maximum gives way. */
function macroRange(kcal, protein){
  const fMin = Math.round(kcal * 0.20 / 9);
  const fMax = Math.max(fMin, Math.min(Math.round(kcal * 0.35 / 9), Math.floor((kcal - protein * 4 - 200) / 9)));
  return { fMin, fMax, sfMax: Math.round(kcal * 0.10 / 9), cMax: Math.max(50, Math.round((kcal - protein * 4 - fMin * 9) / 4)) };
}

/* Your minimum, readable: the three rules side by side, and the highest one is your minimum. */
function minExplainHTML(){
  const P = S.profile, T = P.targets; if (!T || T.fRest == null) return '';
  const win = T.floorWhy, row = (id, label, sub, val) => `<div class="minrule${win === id ? ' win' : ''}"><span><span>${label}</span>${sub ? `<span class="note">${sub}</span>` : ''}${win === id ? '<span class="pill">✓ dit is je minimum</span>' : ''}</span><b class="num">${val}</b></div>`;
  return `<div class="card minexplain"><h3><span>Zo werkt je minimum</span><span class="num">${T.floor} kcal</span></h3>
    <p class="note" style="margin:0">Knabbel kijkt naar drie regels. De hoogste is je minimum: daaronder gaat je eetdoel nooit.</p>
    <div class="minrules">
    ${row('abs', 'Vaste ondergrens', P.sex === 'm' ? 'voor mannen' : 'voor vrouwen', `${T.fAbs} kcal`)}
    ${row('rest', '80% van je rustverbruik', `je verbrandt in rust ${T.measured ? T.bmrReal : T.bmr} kcal`, `${T.fRest} kcal`)}
    ${T.measured ? row('pct', '25% onder je verbruik', `gemeten: ${T.tdee} kcal`, `${T.fPct} kcal`)
      : `<div class="minrule off"><span><span>25% onder je verbruik</span><span class="note">telt mee als Knabbel je verbruik heeft gemeten (na ± 4 weken)</span></span><b class="num">–</b></div>`}
    </div>
    <p class="note" style="margin:0">Je rustverbruik komt uit je leeftijd, lengte en gewicht (de Mifflin-St Jeor-formule). Minder eten dan je minimum kost spieren en energie, en je krijgt moeilijk genoeg voedingsstoffen binnen.</p></div>`;
}
/* ---------- what the eat goal is made of ---------- */
function goalExplainHTML(){
  const P = S.profile, T = P.targets, k = todayKey(), B = budget(k), hc = moveOn();
  const line = (label, val, cls = '') => `<div class="eq ${cls}"><span>${label}</span><b class="num">${val}</b></div>`;
  const lines = [line(T.measured ? 'Je verbruikt per dag (gemeten)' : 'Je verbruikt per dag', `${T.tdee} kcal`)];
  if (P.goal === 'lose') lines.push(line(`Minder eten om ${rateStr(P.rate)} kg per week af te vallen`, `− ${-T.change}`, 'minus'));
  if (isGain(P.goal)) lines.push(line(P.goal === 'muscle' ? 'Klein beetje extra voor spieropbouw' : 'Extra eten om aan te komen', `+ ${T.change}`, 'plus'));
  if (P.adjust) lines.push(line('Bijgesteld na je weegmomenten', `${P.adjust > 0 ? '+' : '−'} ${Math.abs(P.adjust)}`, P.adjust > 0 ? 'plus' : 'minus'));
  if (T.floored) lines.push(line(T.floorWhy === 'pct' ? `Opgehoogd: niet meer dan 25% onder je verbruik (minimum ${T.floor})` : T.floorWhy === 'rest' ? `Opgehoogd tot je minimum van ${T.floor} (80% van je rustverbruik)` : `Opgehoogd tot het minimum van ${T.floor} (nooit onder ${P.sex === 'm' ? 1500 : 1200})`, `+ ${T.kcal - T.raw}`, 'plus'));
  // The goal is rounded to tens: say so, so the sum on screen adds up (2065 − 550 = 1515 → 1510).
  const sum = T.tdee + (T.change || 0) + (P.adjust || 0), rd = T.kcal - sum;
  if (!T.floored && rd) lines.push(line('Afgerond op tientallen', `${rd > 0 ? '+' : '−'} ${Math.abs(rd)}`, rd > 0 ? 'plus' : 'minus'));
  lines.push(line('Je eetdoel', `${T.kcal} kcal`, 'total'));
  if (hc && B.bonus) { lines.push(line('Extra door je beweging vandaag', `+ ${B.bonus}`, 'plus')); lines.push(line('Vandaag mag je eten', `${B.kcal} kcal`, 'total')); }
  const WB = firstLogKey() ? weekBudget() : null;
  const effect = P.goal === 'lose' ? `val je ${kgStr(T.effRate)} kg per week af` : P.goal === 'muscle' ? 'kom je heel rustig aan (± 0,2 kg per week), en met krachttraining is dat vooral spier' : isGain(P.goal) ? 'kom je rustig aan' : 'blijf je op gewicht';
  return `
    <p>Je eetdoel is <b>hoeveel je per dag mag eten en drinken</b>. Eet je gemiddeld zoveel, dan ${effect}.</p>
    <div class="card eqs">${lines.join('')}</div>
    ${WB && Math.abs(WB.saved) >= 50 ? `<p class="note">${WB.saved > 0 ? `Weekbudget: je gemiddelde over maandag t/m zondag. Deze week at je ${r0(WB.saved)} kcal minder dan je doel. Die mag je, als je wilt, later in de week extra eten: ± ${WB.perDay} kcal per dag t/m zondag. Je eetdoel hierboven verandert daar niet door. Meer bij Voortgang, Deze week.` : `Weekbudget: je gemiddelde over maandag t/m zondag. Deze week at je ${r0(-WB.saved)} kcal meer dan je doel. ${WB.low ? `Haal dat niet in door onder je minimum van ${minKcal()} kcal te eten: dan val je deze week gewoon iets minder af.` : `Dat maak je goed met ± ${WB.perDay} kcal per dag t/m zondag.`} Meer bij Voortgang, Deze week.`}</p>` : ''}
    <div class="card ringlegend"><b>De tekens in de ring</b>
      <span><span aria-hidden="true" class="tickmark"></span> Het streepje: je minimum van ${minKcal()} kcal. Minder eten is niet goed voor je.</span>
      <span><span aria-hidden="true" class="nowdot"></span> Het bolletje: waar je rond deze tijd ongeveer zou zitten, als je je maaltijden eet zoals meestal.</span>
      <span><span aria-hidden="true" class="lapmark"></span> Boven je doel kleurt de ring lichter en loopt er een rood rondje overheen. Een kwart rondje rood is een kwart van je eetdoel extra; helemaal rond is twee keer je eetdoel.</span></div>
    <p class="note">Een dag meer of minder is niet erg. Het gaat om het gemiddelde over de week.</p>
    ${minExplainHTML()}
    <details class="more"><summary>Hoe weet Knabbel wat ik verbruik?</summary>
      ${T.measured ? `<p><b>Gemeten bij jou:</b> uit wat je de laatste 4 weken at en hoe je gewicht veranderde, verbruik je ongeveer ${P.burn.measured} kcal per dag${P.burn.extra ? ` (waarvan ± ${P.burn.extra} door beweging)` : ''}. De formule schat ${T.tdeeF} kcal. Je eetdoel schuift elke week hooguit 50 kcal naar je gemeten verbruik toe${P.burn.target !== P.burn.base ? ` (nu ${T.tdee}, op weg naar ${P.burn.target})` : ''}. De eerste 10 dagen tellen niet mee: dan verlies je vooral vocht.</p><p>Hieronder de formule waar Knabbel mee begon.</p>` : `<p>Nu nog met een formule. Log je ± 4 weken je eten en weeg je elke week, dan meet Knabbel je echte verbruik en past je eetdoel zich aan jouw lichaam aan.</p>`}
      <p>In rust verbrand je ${T.bmr} kcal (ademen, hartslag, warm blijven). Daar komt ${T.tdeeF - T.bmr} kcal bij voor gewone dagelijkse dingen${S.meta.health.on ? '' : S.meta.manualMove ? `, op basis van "${({ 1.2: 'vooral zittend', 1.3: 'veel lopen of fietsen', 1.4: 'staand of lichamelijk werk' })[S.meta.dailyAct || 1.2]}" (zonder sport)` : `, op basis van "${(ACT.find(a => a[0] === P.activity) || [0, ''])[1].toLowerCase()}"`}. Dit is berekend uit je leeftijd, lengte en gewicht.</p>
      ${T.floored ? `<p>Je eetdoel gaat nooit onder ${T.floor} kcal. Daardoor val je ${kgStr(T.effRate)} kg per week af in plaats van ${rateStr(P.rate)} kg.</p>` : ''}
      ${hc ? `<p>${moveWhy(k)}</p>` : ''}
    </details>
    <details class="more"><summary>Eiwit, koolhydraten en vet</summary>
      ${macroExplainBody(k)}
    </details>
    <button class="btn block ghost" data-act="goto-profile">Doel aanpassen</button>`;
}

/* ---------- move goal: active kcal burned per day ---------- */
/* Brisk walking burns ± 3,3 kcal per kg per hour on top of sitting (MET 4,3 − 1). The same sum everywhere. */
const walkPerMin = () => 3.3 * ((S.profile && S.profile.weight) || 75) / 60;
const walkMin = kcal => Math.max(1, Math.ceil(kcal / walkPerMin() / 5) * 5);
function moveGoalHTML(k){
  const goal = S.profile.moveGoal || 0; if (!goal) return '';
  const done = r0(moveKcal(k)), rest = goal - done;
  const perMin = walkPerMin();
  return `<div class="macro" style="display:flex;flex-direction:column;gap:6px">
    <div class="row between"><span style="font-weight:700">Beweegdoel</span><span class="num muted" style="font-weight:700">${done} / ${goal} kcal verbrand</span></div>
    <div class="bar" style="height:10px"><i style="width:${clamp(done / goal * 100, 0, 100)}%;background:var(--sky)"></i></div>
    <p class="note">${rest <= 0 ? '<b style="color:var(--leaf)">✓ Beweegdoel gehaald!</b>' : k === todayKey() ? `Nog ${rest} kcal. Dat is ongeveer ${walkMin(rest)} minuten stevig wandelen.` : `${rest} kcal onder je doel.`}</p></div>`;
}
function checkMoveGoal(){
  const k = todayKey(), goal = S.profile?.moveGoal;
  if (!goal || !moveOn() || !S.days[k]) return;
  const d = ensureDay(k);
  if (!d.flags.move && moveKcal(k) >= goal) { d.flags.move = true; save(); reward(5, 15, 'Beweegdoel gehaald!'); }
}

/* ---------- movement (Health Connect) ---------- */
/* Extra kcal burned by moving, best source first: measured active kcal, then total kcal minus
   resting burn, then an estimate from steps plus each workout's MET value. */
/* kcal  = active kcal as your watch/phone reports it (this is what the move goal counts)
   extra = the part on top of the ordinary daily movement that the eat goal already includes */
/* Workouts you entered yourself: kcal burned by moving (MET × weight × hours); "extra" leaves out
   what you would have burned sitting anyway. */
const SPORTS = [
  ['wandelen', 'Stevig wandelen', 4.3, '🚶'], ['fietsen', 'Fietsen', 6.8, '🚴'], ['hardlopen', 'Hardlopen', 9.8, '🏃'],
  ['zwemmen', 'Zwemmen', 7, '🏊'], ['kracht', 'Fitness / kracht', 5, '🏋️'], ['cardio', 'Cardio-apparaat', 7, '🚣'],
  ['dansen', 'Dansen', 5.5, '💃'], ['teamsport', 'Voetbal / teamsport', 7, '⚽'], ['tennis', 'Tennis / padel', 7.3, '🎾'],
  ['yoga', 'Yoga / pilates', 3, '🧘'], ['tuin', 'Tuinieren / klussen', 4, '🌱'], ['anders', 'Iets anders', 0, '✨']
];
/* kcal from a watch or app can be far off, in both directions. When there are two estimates (what the watch says and
   what the MET formula says) the middle between the highest and the lowest one counts. */
const midway = (a, b) => (Math.min(a, b) + Math.max(a, b)) / 2;
function workoutKcal(wk){
  // Active kcal only ((MET − 1) × kg × hours), like a session from Health Connect: what you burn sitting still is
  // already in your eat goal, and the move goal counts active kcal. So the same walk counts the same either way.
  const w = S.profile?.weight || 75, rest = w * (wk.min || 0) / 60, act = Math.max(0, (wk.met || 4) - 1) * rest;
  if (wk.kcal != null) { const kc = wk.met ? midway(wk.kcal, act) : wk.kcal; return { kcal: kc, extra: wk.met ? kc : Math.max(0, kc - rest), watch: wk.kcal, est: wk.met ? act : null }; }
  return { kcal: act, extra: act };
}
/* One session from Health Connect: the watch's active kcal for that session and the MET estimate ((MET − 1) × kg × hours,
   so without what you burn at rest anyway), and the middle of the two. */
function sessionKcal(s){
  const w = S.profile?.weight || 75, est = Math.max(0, (s.met || 4.5) - 1) * w * (s.min || 0) / 60;
  return s.kcal > 0 ? { kcal: midway(s.kcal, est), watch: s.kcal, est } : { kcal: est, watch: null, est };
}
function moveInfo(k){
  const hc = hcMoveInfo(k), ws = day(k).workouts || [];
  if (!ws.length) return hc;
  const add = ws.reduce((a, wk) => { const x = workoutKcal(wk); return { kcal: a.kcal + x.kcal, extra: a.extra + x.extra }; }, { kcal: 0, extra: 0 });
  return { kcal: hc.kcal + add.kcal, extra: hc.extra + add.extra, how: hc.kcal > 0 ? hc.how : 'geschat' };
}
function hcMoveInfo(k){
  const m = day(k).move; if (!m) return { kcal: 0, extra: 0, how: 'geschat' };
  const bmr = S.profile?.targets.bmr || 1600, w = S.profile?.weight || 75;
  const frac = k === todayKey() ? clamp((Date.now() - dateOf(k)) / 864e5, 0, 1) : 1;
  // Ordinary daily movement is already in your eat goal (10% of your resting burn). That share used to grow through the
  // day, so the bonus dropped a little every time you looked while sitting still (2008 → 2007). Now the whole day's share
  // is taken off at once: the bonus only starts once you moved more than an ordinary day, and then only goes up. At the
  // end of the day it is exactly the same number as before.
  const inGoal = 0.2 * bmr;   // the eat goal counts a sitting day as resting burn × 1.2: the 20% is in it already
  // What the watch measured (active kcal, or total minus resting burn) next to an estimate from steps and sessions.
  const measured = m.kcal > 0 ? m.kcal : m.total - bmr * frac > 0 ? m.total - bmr * frac : 0;
  const estActive = (m.steps || 0) * 0.0004 * w + (Array.isArray(m.sessions) ? m.sessions.reduce((a, s) => a + (s.walk && m.steps > 0 ? 0 : Math.max(0, (s.met || 4.5) - 1) * w * (s.min || 0) / 60), 0) : 0);
  if (measured > 0 && estActive > 0) { const kc = midway(measured, estActive); return { kcal: kc, extra: Math.max(0, kc - inGoal), how: 'gemiddeld', watch: measured, est: estActive }; }
  if (measured > 0) return { kcal: measured, extra: Math.max(0, measured - inGoal), how: 'gemeten' };
  // Estimates already leave out ordinary movement: the first 3000 steps and the resting part of a workout.
  let kc = Math.max(0, (m.steps || 0) - 3000) * 0.0004 * w;
  if (Array.isArray(m.sessions)) m.sessions.forEach(s => { if (!(s.walk && m.steps > 0)) kc += Math.max(0, (s.met || 4.5) - 1) * w * (s.min || 0) / 60; });
  else if (m.min) kc += 3.5 * w * m.min / 60;
  return { kcal: kc, extra: kc, how: 'geschat' };
}
const moveKcal = k => moveInfo(k).kcal;
/* What moving does for your eat goal, in words: what you moved, the part an ordinary day already has (that is in your
   eat goal already, so early in the day the extra is often still 0), and what it gives you extra to eat. */
function moveWhy(k){
  const mi = moveInfo(k), bonus = budget(k).bonus, pct = S.meta.health.pct ?? 50, when = k === todayKey() ? 'vandaag' : 'die dag';
  // The watch part of the bonus goes in steps of 10 kcal (see moveBonus): say so when the sum doesn't add up exactly.
  const gets = `daarvan telt ${pct}% mee${Math.abs(bonus - mi.extra * pct / 100) >= 1 ? ' (afgerond)' : ''}: <b>+${bonus} kcal</b> extra eten ${when}.`;
  if (!measuredMove()) return mi.kcal > 0 ? `Sport ${when}: ${r0(mi.kcal)} kcal. Je eetdoel gaat uit van een dag zonder sport, dus dit is helemaal extra. Daarvan telt ${pct}% mee: <b>+${bonus} kcal</b> extra eten ${when}.` : `Sport ${when}: nog niets ingevuld.`;
  if (mi.how === 'geschat') return mi.kcal > 0 ? `Beweging ${when}: ${r0(mi.kcal)} kcal extra, geschat uit je stappen en sport. De eerste 3000 stappen horen bij een gewone dag en zitten al in je eetdoel; die tellen hier niet. ${gets[0].toUpperCase() + gets.slice(1)}`
    : `Beweging ${when}: nog niets extra. De eerste 3000 stappen horen bij een gewone dag en zitten al in je eetdoel.`;
  const base = `De eerste ± ${Math.round(0.2 * S.profile.targets.bmr / 10) * 10} kcal horen bij een gewone dag en zitten al in je eetdoel.`;
  return `Beweging ${when}: ${r0(mi.kcal)} kcal actief, gemeten door je telefoon of horloge. ${base} ${mi.extra >= 1 ? `Daarboven bewoog je ${r0(mi.extra)} kcal, en ${gets}`
    : `Daar zit je nog onder, dus er komt nog niets bij. Van wat je daarboven beweegt, telt ${pct}% mee.`}`;
}
/* Today's goals. Protein is a goal in grams. Fat may be anywhere between fMin and fMax. Carbs fill up the rest of the kcal,
   so they move along with what you eat: more fat (up to fMax) or more protein than your goal leaves less room for carbs.
   Fat under fMin still keeps fMin free, so you don't eat that room away with carbs. "add" is a meal you are thinking about. */
function macroGoals(k, add){
  const g = goalOf(k), pGoal = g && g.p ? g.p : S.profile.targets.p, kcal = budget(k).kcal, R = macroRange(kcal, pGoal), t = totals(k);
  const pUse = Math.max(pGoal, t.p + (add?.p || 0)), fUse = clamp(t.f + (add?.f || 0), R.fMin, R.fMax);
  const c = Math.max(50, Math.round((kcal - pUse * 4 - fUse * 9) / 4));
  return { p: pGoal, c, f: R.fMax, fMin: R.fMin, fMax: R.fMax, sfMax: R.sfMax, cMax: R.cMax };
}
/* A past day keeps the eat goal it had (stamped on the day while it was today, see save), so changing your goal or
   pace today doesn't turn yesterday into "over your goal" afterwards. Days from before the stamp use today's goal. */
const goalOf = k => (k < todayKey() && S.days[k] && S.days[k].goal) || null;
function budget(k){
  const g = goalOf(k), base = g ? g.kcal : S.profile.targets.kcal;
  const bonus = moveBonus(k);
  return { kcal: base + bonus, base, bonus };
}
/* The extra kcal for moving: what your watch/phone measured (Health Connect) plus your own workouts, the share you chose
   (50% by default). The Health Connect part goes in steps of 10 kcal and never back down on a day: a watch that
   counts its resting burn a little differently than Knabbel made it wobble a few kcal up and down every 5 minutes. It
   starts again when you change the share or which steps count. Workouts you remove do come off. */
function moveBonus(k){
  if (!moveOn()) return 0;
  const pct = (S.meta.health.pct ?? 50) / 100, all = moveInfo(k).extra, hc = hcMoveInfo(k).extra;
  let h = Math.floor(hc * pct / 10) * 10;
  const d = S.days[k], sig = `${pct}|${S.meta.health.stepsFrom || 'max'}`;
  if (d) { const m = d.moveHold; if (m && m.sig === sig && m.v > h) h = m.v; else if (!m || m.sig !== sig || m.v !== h) d.moveHold = { sig, v: h }; }
  return h + r0(Math.max(0, all - hc) * pct);
}
/* Which steps count. Health Connect's own total takes one app per moment (by its priority list, and only apps in that
   list), so with a phone and a watch it often drops part of the watch's steps. Default: the app with the most steps
   (one app's own count, so never counted twice; with a watch that is nearly always the watch). You can also pick the
   Health Connect total or one app (Beweging → Stappen per app). */
function chooseSteps(total, src){
  const pick = (S.meta.health && S.meta.health.stepsFrom) || 'max';
  if (!src || pick === 'hc') return total;
  const counts = Object.values(src).filter(n => n > 0);
  if (pick === 'max') return counts.length ? Math.max(...counts) : total;
  return src[pick] != null ? src[pick] : total;
}
/* After changing the choice: the days already read get the chosen steps too. */
function applyStepsChoice(){
  Object.values(S.days).forEach(d => { const m = d.move; if (m && m.stepSrc) { m.hcSteps ??= m.steps; m.steps = chooseSteps(m.hcSteps, m.stepSrc); } });
}
let healthStatus = null, healthMissing = false;
async function refreshHealth(keys){
  if (!Native || !S.meta.health.on) return;
  let changed = false;
  for (const k of keys) {
    try {
      const m = await nat('health.day', { date: k });
      const old = day(k).move;
      const next = { steps: chooseSteps(m.steps || 0, m.stepSrc), hcSteps: m.steps || 0, kcal: r0(m.kcal), total: r0(m.total), min: m.min || 0, sessions: m.sessions || [], sleep: m.sleepMin || 0, stepSrc: m.stepSrc || null };
      const same = old && ['steps', 'hcSteps', 'kcal', 'total', 'min', 'sleep'].every(f => r0(old[f] || 0) === next[f]) && JSON.stringify(old.sessions || []) === JSON.stringify(next.sessions) && JSON.stringify(old.stepSrc || null) === JSON.stringify(next.stepSrc);
      if (!same && (next.steps || next.kcal || next.total || next.min || S.days[k])) { ensureDay(k).move = { ...next, at: Date.now() }; changed = true; }
    } catch (e) { if (e === 'no_permission') { healthStatus = 'no_permission'; break; } }
  }
  if (changed) { save(); checkMoveGoal(); if (!sheetOpen()) render(); }
}

/* ---------- weekly check-in ---------- */
function firstLogKey(){
  // The earliest day with something logged, in one pass (called often; sorting every day each time was slow).
  let first = null;
  for (const k in S.days) if ((S.days[k].entries || []).length && (first === null || k < first)) first = k;
  // The start of your schedule is kept once it is known: logging an earlier day later, or removing the food of the first
  // day, no longer moves the week numbers, the weigh-ins and "since start" (the app then asked for a weigh-in again at once).
  if (first === null) { if (S.meta.startKey) delete S.meta.startKey; return null; }
  if (S.meta.startKey && S.meta.startKey <= todayKey()) return S.meta.startKey;
  S.meta.startKey = first;
  return first;
}
/* When will you reach your goal weight? From how your weight really moved over the last 4 weeks (a straight line
   through your weigh-ins), with a margin of 25% either way. With too few weigh-ins (or a trend going the wrong way)
   it uses your schedule instead and says so. Also: your real pace next to the planned one, and what it brought so far. */
const MONTHS_FULL = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
const longDate = k => { const x = dateOf(k); return `${x.getDate()} ${MONTHS_FULL[x.getMonth()]}${x.getFullYear() !== new Date().getFullYear() ? ' ' + x.getFullYear() : ''}`; };
function weightSlope(days = 28, newestAs = null){
  const k = todayKey(), from = shiftKey(k, -days);
  let list = S.meta.weights.filter(w => w.date >= from && w.date <= k);
  // An outlier as newest weigh-in counts as what the line before it expected (see newestIsSpike).
  if (newestAs != null && list.length) { list = [...list].sort((a, b) => a.date.localeCompare(b.date)); list[list.length - 1] = { ...list[list.length - 1], kg: newestAs }; }
  const pts = list.map(w => [daysBetween(from, w.date), w.kg]);
  if (pts.length < 3 || Math.max(...pts.map(p => p[0])) - Math.min(...pts.map(p => p[0])) < 14) return null;
  const n = pts.length, sx = pts.reduce((a, p) => a + p[0], 0), sy = pts.reduce((a, p) => a + p[1], 0);
  const sxx = pts.reduce((a, p) => a + p[0] * p[0], 0), sxy = pts.reduce((a, p) => a + p[0] * p[1], 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  return isFinite(slope) ? slope : null;                            // kg per day
}
/* Your pace in kg per day (the line through 4 weeks of weigh-ins). An outlier as newest weigh-in (newestIsSpike) counts
   as what the line before it expected, until the next weigh-in shows the same. Used by the forecast and the chart. */
function paceSlope(){
  if (newestIsSpike()) { const s = weightSlope(28, trendWithoutNewest()); if (s != null) return s; }
  return weightSlope();
}
function goalForecast(){
  const P = S.profile, T = P.targets, all = weightSeries(), last = all[all.length - 1];
  if (!P.goalWeight || P.goal === 'maintain' || !last) return null;
  const now = trendNow() ?? last.kg, togo = P.goalWeight - now, dir = Math.sign(togo);
  const lost = startWeight() - last.kg;                              // like "sinds start" above the chart
  const base = { now, togo, lost, kcal: Math.round(Math.abs(lost) * 7700 / 1000) * 1000, plan: T.effRate || 0 };
  if (P.goal === 'lose' ? now <= P.goalWeight : now >= P.goalWeight) return { ...base, reached: true };
  // kg per week towards the goal. One weigh-in alone doesn't make the pace look worse: then the line without it counts,
  // until the next weigh-in shows the same.
  const s = paceSlope(), real = s != null ? s * 7 * dir : null;
  const fromPace = (perWeek, how) => {
    const days = Math.abs(togo) / (perWeek / 7);
    if (!(days > 0) || days > 730) return { ...base, real, how, far: true };
    const d = k => shiftKey(todayKey(), Math.round(k));
    return { ...base, real, how, date: d(days), early: how === 'trend' ? d(days / 1.25) : null, late: how === 'trend' ? d(days / 0.75) : null };
  };
  if (real != null && real >= 0.05) return fromPace(real, 'trend');
  if (real != null && real < -0.05) return { ...base, real, how: 'none' };   // going the wrong way: a date would mislead
  return T.effRate > 0 ? fromPace(T.effRate, 'schema') : { ...base, real, how: 'none' };
}
/* Pace in words: on track, behind (with the kcal per day that would close the gap) or ahead. */
function paceAdvice(F){
  if (F.real == null || !F.plan) return '';
  const lose = S.profile.goal === 'lose', w = n => rateStr(r1(Math.max(0, n)));
  if (F.real < -0.05) return `Je gewicht gaat de laatste weken ${lose ? 'omhoog' : 'omlaag'} (± ${w(Math.abs(F.real))} kg per week) in plaats van ${lose ? 'omlaag' : 'omhoog'}. Kijk of je alles logt en of je porties kloppen, bijvoorbeeld door eens te wegen. Bij het weegmoment stelt ${esc(S.meta.pet.name)} je eetdoel zo nodig bij.`;
  if (F.real < F.plan * 0.8) {
    const gap = Math.round((F.plan - Math.max(0, F.real)) * 7700 / 7 / 10) * 10, T = S.profile.targets, room = T.kcal - T.floor;
    const now = `Je ${lose ? 'valt' : 'komt'} nu ${w(F.real)} kg per week ${lose ? 'af' : 'aan'}, je plan is ${w(F.plan)}.`;
    if (lose && room <= 20) return `${now} Je eetdoel staat al op je minimum, dus minder eten is geen goed idee. Meer bewegen helpt dan het meest, en kijk of je porties kloppen.`;
    if (lose && gap > room + 20) return `${now} Daarvoor zou je ± ${gap} kcal per dag minder moeten eten, maar je eetdoel kan maar ${room} kcal omlaag tot je minimum. Eet dus hooguit ${room} kcal minder en beweeg wat meer.`;
    return `${now} Met ongeveer ${gap} kcal per dag ${lose ? 'minder' : 'meer'} zit je weer op schema. Kleine stapjes zijn genoeg.`;
  }
  if (F.real > F.plan * 1.3) return `Je gaat sneller dan je plan: ${w(F.real)} kg per week in plaats van ${w(F.plan)}. Mooi, maar eet wel genoeg: sneller dan 1% van je gewicht per week kost spieren.`;
  return `Je ${lose ? 'valt' : 'komt'} ${w(F.real)} kg per week ${lose ? 'af' : 'aan'}, ${Math.abs(F.real - F.plan) <= F.plan * 0.1 ? 'precies' : 'ongeveer'} zoals gepland (${w(F.plan)}). Zo doorgaan!`;
}
/* The numbers view of the weight card: four tiles to read at a glance, Knabbel's word on your pace,
   and a link to how it is worked out. A tile opens the same explanation. */
let wView = 'chart';
const dayMonth = k => { const x = dateOf(k); return `${x.getDate()} ${MONTHS[x.getMonth()]}${x.getFullYear() !== new Date().getFullYear() ? " '" + String(x.getFullYear()).slice(2) : ''}`; };
function weightStatsHTML(){
  const F = goalForecast(), P = S.profile, lose = P.goal === 'lose', got = lose ? F.lost : -F.lost;
  const tile = (label, big, sub, warn) => `<button class="wtile" data-act="explain-forecast"><span class="eyebrow">${label}</span><b class="num"${warn ? ' style="color:var(--warn-ink)"' : ''}>${big}</b><span class="note num">${sub}</span></button>`;
  const when = F.reached ? tile('Streefgewicht', 'Bereikt! 🎉', `${kgStr(P.goalWeight)} kg`)
    : F.date ? tile('Streefgewicht', dayMonth(F.date), F.early ? `± ${dayMonth(F.early).replace(/ '\d+$/, '')} – ${dayMonth(F.late).replace(/ '\d+$/, '')}` : 'volgens je schema')
    : tile('Streefgewicht', F.far ? 'ruim 2 jaar' : 'nog onbekend', F.far ? 'in dit tempo' : 'weeg wat vaker');
  const slow = F.real != null && F.plan && F.real < F.plan * 0.8;
  const pace = F.real != null ? tile('Tempo', `${rateStr(r1(Math.max(0, F.real)))} kg`, `per week · plan ${rateStr(F.plan)}`, slow) : tile('Tempo', '–', 'weeg 3× in 2 weken');
  const done = tile('Al bereikt', `${got >= 0.05 ? (lose ? '−' : '+') : ''}${Math.abs(F.lost).toFixed(1).replace('.', ',')} kg`, got >= 0.5 ? `≈ ${F.kcal.toLocaleString('nl-NL')} kcal` : 'sinds je start');
  const lastKg = weightSeries().slice(-1)[0].kg;
  const togo = tile('Nog te gaan', F.reached ? '0 kg' : `${kgStr(Math.abs(P.goalWeight - lastKg))} kg`, `tot ${kgStr(P.goalWeight)} kg`);
  const adv = F.reached ? '' : paceAdvice(F);
  return `<div class="wstats">${when}${pace}${done}${togo}</div>
    ${adv ? `<p class="bubble">${esc(S.meta.pet.name)}: ${adv}</p>` : ''}
    <button class="add-line" data-act="explain-forecast">Hoe is dit berekend? ›</button>`;
}
function forecastHTML(){
  const F = goalForecast(), P = S.profile; if (!F) return '';
  const line = (l, v) => `<div class="eq"><span>${l}</span><b class="num">${v}</b></div>`;
  const lose = P.goal === 'lose', got = lose ? F.lost : -F.lost;
  const head = F.reached ? `<p><b>Je hebt je streefgewicht van ${kgStr(P.goalWeight)} kg bereikt!</b> Wil je verder, pas dan je streefgewicht aan bij Jij &amp; je doel.</p>`
    : F.date ? `<div class="fc-big"><span class="eyebrow">${F.how === 'trend' ? 'Als je zo doorgaat' : 'Volgens je schema'}</span><b class="num">rond ${longDate(F.date)}</b>${F.early ? `<span class="note num">ergens tussen ${longDate(F.early)} en ${longDate(F.late)}</span>` : ''}</div>`
    : F.far ? `<p>In dit tempo duurt het nog meer dan 2 jaar. Kijk hieronder hoe je weer op schema komt.</p>`
    : `<p>Je gewicht gaat de laatste weken nog niet de goede kant op, dus een datum is nog niet te zeggen.</p>`;
  return `${head}
    <div class="card eqs">
      ${trendNow() != null ? line(`Laatste weging (${shortDate(weightSeries().slice(-1)[0].date)})`, `${kgStr(weightSeries().slice(-1)[0].kg)} kg`) : ''}
      ${line(trendNow() != null ? 'Nu volgens je trend' : 'Nu', `${kgStr(F.now)} kg`)}
      ${line('Streefgewicht', `${kgStr(P.goalWeight)} kg`)}
      ${F.reached ? '' : line('Nog te gaan', `${kgStr(Math.abs(P.goalWeight - weightSeries().slice(-1)[0].kg))} kg`)}
      ${F.real != null ? line('Jouw tempo (laatste 4 weken)', `${rateStr(r1(Math.max(0, F.real)))} kg per week`) : ''}
      ${F.plan ? line('Je plan', `${rateStr(F.plan)} kg per week`) : ''}
    </div>
    ${F.reached ? '' : `<p class="muted">${paceAdvice(F) || 'Weeg je de komende 2 weken minstens 3 keer, dan rekent Knabbel met je echte tempo in plaats van je schema.'}</p>`}
    ${got >= 0.5 ? `<p>🎉 Sinds je begon ben je <b class="num">${kgStr(Math.abs(F.lost))} kg ${lose ? 'lichter' : 'zwaarder'}</b>. Dat is ongeveer <b class="num">${F.kcal.toLocaleString('nl-NL')} kcal</b> die je ${lose ? 'minder at dan je verbruikte' : 'meer at dan je verbruikte'}.</p>` : ''}
    <p class="note">${F.how === 'trend' ? `Berekend uit je wegingen van de laatste 4 weken${trendNow() != null ? ', vanaf je trend (die haalt de dagelijkse schommelingen eruit)' : ''}. De marge is 25% sneller of langzamer.` : 'Berekend uit je schema, omdat er nog te weinig wegingen zijn of je trend nog niet de goede kant op gaat.'} Hoe vaker je weegt, hoe beter de schatting.</p>
    <button class="btn block" data-act="close">Oké</button>`;
}
/* What Knabbel says about it: a new whole kilo first (once), otherwise the expected date. */
function forecastLine(){
  const F = goalForecast(); if (!F) return '';
  const lose = S.profile.goal === 'lose', got = lose ? F.lost : -F.lost, whole = Math.floor(got);
  if (whole >= 1 && whole > (S.meta.kgCheered || 0)) {
    S.meta.kgCheered = whole; save();
    return `Al ${whole} kg ${lose ? 'eraf' : 'erbij'}! Dat is zo'n ${(Math.round(got * 7700 / 1000) * 1000).toLocaleString('nl-NL')} kcal. Ik ben trots op je!`;
  }
  if (F.reached || !F.date) return '';
  return F.how === 'trend' ? `Als je zo doorgaat, ben je rond ${longDate(F.date)} op ${kgStr(S.profile.goalWeight)} kg!` : `Volgens je schema ben je rond ${longDate(F.date)} op ${kgStr(S.profile.goalWeight)} kg.`;
}
function startWeight(){
  const f = firstLogKey(); const ws = [...S.meta.weights].sort((a, b) => a.date.localeCompare(b.date));
  if (!ws.length) return S.profile.weight;
  const before = ws.filter(w => w.date <= (f || todayKey()));
  return (before.length ? before[before.length - 1] : ws[0]).kg;
}
function weeklyRate(){ const p = S.profile, eff = p.targets?.effRate ?? p.rate; return p.goal === 'lose' ? -eff : isGain(p.goal) ? (p.targets?.effRate || 0.25) : 0; }
function expectedAt(k){ return expectedFn()(k); }
/* The schedule as a function of the day, with its start worked out once (the chart asks it for every weigh-in). */
function expectedFn(){
  const f = firstLogKey(); if (!f) return () => null;
  const sw = startWeight(), rate = weeklyRate(), g = S.profile.goalWeight, P = S.profile;
  return k => {
    const v = sw + rate * (daysBetween(f, k) / 7);
    if (g && P.goal === 'lose' && sw > g) return Math.max(g, v);
    if (g && isGain(P.goal) && sw < g) return Math.min(g, v);
    return v;
  };
}
function dueWeek(){
  const f = firstLogKey(); if (!f) return 0;
  const w = Math.floor(daysBetween(f, todayKey()) / 7);
  if (w < 1) return 0;
  return S.meta.checkins.some(c => c.week === w) ? 0 : w;
}
function nextCheckinKey(){
  const f = firstLogKey(); if (!f) return null;
  const done = S.meta.checkins.reduce((m, c) => Math.max(m, c.week), 0);
  const cur = Math.floor(daysBetween(f, todayKey()) / 7);
  const next = dueWeek() ? cur : Math.max(done, cur) + 1;
  return shiftKey(f, next * 7);
}
function scheduleReminder(){
  if (!Native) return;
  const k = nextCheckinKey(); if (!k) return;
  let at = dateOf(k); at.setHours(9, 0, 0, 0);
  if (at.getTime() <= Date.now()) { const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(9, 0, 0, 0); at = t; }
  if (Math.abs((S.meta.notifAt || 0) - at.getTime()) < 60000) return;
  S.meta.notifAt = at.getTime(); save();
  const w = Math.max(1, Math.round(daysBetween(firstLogKey(), keyOf(at)) / 7));
  nat('notify.schedule', { at: at.getTime(), title: 'Tijd voor je weegmoment', text: `Week ${w}: stap even op de weegschaal en kijk of je op schema ligt.` }).catch(() => {});
}
function assess(kg, week){
  const P = S.profile, f = firstLogKey() || todayKey(), k = todayKey();
  const start = startWeight(), exp = expectedAt(k), tr = trendNow(), cmp = tr != null ? tr : kg;
  // One weigh-in far off the line of the ones before (newestIsSpike) doesn't change the advice yet, up or down: a water
  // spike then doesn't give "lower your eat goal", a dry morning not "ahead of schedule". The next weigh-in decides.
  const trPrev = newestIsSpike() ? trendWithoutNewest() : null;
  const milder = trPrev != null ? trPrev : cmp;
  const spike = trPrev != null && Math.abs(cmp - milder) >= 0.15;
  const diff = milder - exp;
  const weeks = daysBetween(f, k) / 7;
  const lost = start - kg;
  const keys = Array.from({ length: 7 }, (_, i) => shiftKey(k, -i - 1)).filter(fullDay);
  const avg = keys.length ? keys.reduce((a, x) => a + totals(x).kcal, 0) / keys.length : 0;
  const avgBudget = keys.length ? keys.reduce((a, x) => a + budget(x).kcal, 0) / keys.length : budget(k).kcal;
  const tol = 0.5;
  let status, title, advice = [], action = null;
  if (P.goal === 'lose') {
    const perWeek = weeks > 0 ? lost / weeks : 0;
    if (diff <= tol && perWeek > kg * 0.01 * 1.1 && weeks >= 2) { status = 'warn'; title = 'Je gaat sneller dan gepland';
      advice.push(`Je verliest gemiddeld ${kgStr(perWeek)} kg per week. Meer dan 1% van je gewicht per week kost vaak spiermassa.`);
      action = { adj: 100, label: 'Eetdoel 100 kcal verhogen' }; }
    else if (diff <= -tol) { status = 'good'; title = 'Je loopt voor op schema'; advice.push(`Je zit ${kgStr(-diff)} kg onder het geplande gewicht. Goed bezig!`); }
    else if (diff <= tol) { status = 'good'; title = 'Je ligt op schema'; advice.push(`Gepland was ${kgStr(exp)} kg, je weegt ${kgStr(kg)} kg.`); }
    else { status = 'bad'; title = 'Je loopt wat achter';
      advice.push(`Gepland was ${kgStr(exp)} kg, je weegt ${kgStr(kg)} kg (${kgStr(diff)} kg erboven).`);
      if (keys.length < 5) advice.push(`Je hebt vorige week maar ${keys.length} van de 7 dagen gelogd. Log elke dag, dan kan ik beter zien waar het misgaat.`);
      else if (avg > avgBudget + 50) advice.push(`Je at gemiddeld ${r0(avg - avgBudget)} kcal per dag boven je doel. Probeer daar eerst op te letten.`);
      else { advice.push('Je eet volgens je doel, maar je gewicht daalt minder hard. Dat kan door vocht komen, of doordat porties hoger zijn dan geschat.'); action = { adj: -100, label: 'Eetdoel 100 kcal verlagen' }; }
    }
  } else if (isGain(P.goal)) {
    const muscle = P.goal === 'muscle', step = muscle ? 100 : 150;
    // Building muscle: gaining much faster than planned is mostly fat, so then say so (and offer to eat a bit less).
    if (muscle && diff >= 1 && weeks >= 3) { status = 'warn'; title = 'Je komt sneller aan dan gepland';
      advice.push(`Gepland was ${kgStr(exp)} kg, je weegt ${kgStr(kg)} kg. Bij spieropbouw is sneller aankomen vooral vet: spieren groeien maar langzaam.`);
      action = { adj: -100, label: 'Eetdoel 100 kcal verlagen' }; }
    else if (diff >= -tol) { status = 'good'; title = 'Je ligt op schema'; advice.push(`Je bent ${kgStr(kg - start)} kg aangekomen sinds de start.${muscle ? ' Blijf trainen en haal je eiwit, dan is dat vooral spier.' : ''}`); }
    else { status = 'bad'; title = 'Je komt langzamer aan dan gepland'; advice.push(`Gepland was ${kgStr(exp)} kg, je weegt ${kgStr(kg)} kg.`); action = { adj: step, label: `Eetdoel ${step} kcal verhogen` }; }
  } else {
    if (Math.abs(kg - start) <= 1) { status = 'good'; title = 'Je blijft mooi op gewicht'; advice.push(`Je zit binnen 1 kg van je startgewicht (${kgStr(start)} kg).`); }
    else { status = 'warn'; title = kg > start ? 'Je bent wat aangekomen' : 'Je bent wat afgevallen'; advice.push(`Je weegt ${kgStr(Math.abs(kg - start))} kg ${kg > start ? 'meer' : 'minder'} dan bij de start.`);
      action = kg > start ? { adj: -100, label: 'Eetdoel 100 kcal verlagen' } : { adj: 100, label: 'Eetdoel 100 kcal verhogen' }; }
  }
  // Lowering the eat goal can't go under the minimum: then say so instead of offering a button that does nothing.
  if (action && action.adj < 0 && P.targets.kcal + action.adj < P.targets.floor) { action = null;
    advice.push(`Je eetdoel staat al (bijna) op je minimum van ${P.targets.floor} kcal, lager gaan we niet. Meer bewegen of je porties eens wegen helpt dan het meest.`); }
  if (spike) advice.push(`Door deze ene weging zou je trend ${kgStr(Math.abs(cmp - milder))} kg ${cmp > milder ? 'omhoog' : 'omlaag'} gaan. Eén ochtend is vaak vocht (zout, koolhydraten, sporten), dus die tel ik nog niet mee in mijn advies. Is je volgende weging ook zo, dan wel.`);
  else if (tr != null) advice.push(`Je trendgewicht is ${kgStr(tr)} kg: daar zijn de schommelingen door vocht uitgefilterd. Daarmee vergelijk ik met je schema.`);
  const real = measureBurn();
  if (real) advice.push(`Uit wat je at en hoe je gewicht veranderde, verbruik je ongeveer ${real.tdee} kcal per dag (op basis van ${real.days} volledig gelogde dagen). De formule schatte ${Math.round((P.targets.tdeeF + real.extra) / 10) * 10}. Je eetdoel schuift daar elke week hooguit 50 kcal naar toe.`);
  if (P.goalWeight && P.goal !== 'maintain') {
    const rate = Math.abs(weeklyRate()), left = Math.abs(kg - P.goalWeight);
    if (rate && ((P.goal === 'lose' && kg > P.goalWeight) || (isGain(P.goal) && kg < P.goalWeight))) {
      const F = goalForecast();
      advice.push(`Nog ${kgStr(left)} kg tot je streefgewicht.${F && F.date ? ` ${F.how === 'trend' ? 'Als je zo doorgaat' : 'Volgens je schema'} haal je dat rond ${longDate(F.date)}.` : ''}`);
    } else if ((P.goal === 'lose' && kg <= P.goalWeight) || (isGain(P.goal) && kg >= P.goalWeight)) {
      advice.push('Je hebt je streefgewicht bereikt! Zet je doel bij Jij & je doel op "Op gewicht blijven".');
    }
  }
  return { week, date: k, kg, start: r1(start), expected: r1(exp), status, title, advice, action, avg: r0(avg), budget: r0(avgBudget), logged: keys.length };
}

/* Real daily burn from the last 4 weeks: average intake + weight change (7700 kcal per kg). Only with at least 14
   logged days and weigh-ins at least 14 days apart. The first 10 days after you started don't count: then you
   mostly lose water, which would make your burn look much too high. */
function measureBurn(){
  const k = todayKey(), f = firstLogKey(); if (!f) return null;
  const from = shiftKey(k, -28), start = shiftKey(f, 10), lo = start > from ? start : from;
  // A day under half of the eat goal was almost certainly not fully logged: it would make the burn look too low.
  const keys = Array.from({ length: 28 }, (_, i) => shiftKey(k, -i - 1)).filter(x => x >= lo && fullDay(x) && totals(x).kcal >= budget(x).base * 0.5);
  if (keys.length < 14) return null;
  const pts = S.meta.weights.filter(w => w.date >= lo && w.date <= k).map(w => [daysBetween(lo, w.date), w.kg]);
  if (pts.length < 3 || Math.max(...pts.map(p => p[0])) - Math.min(...pts.map(p => p[0])) < 14) return null;
  const n = pts.length, sx = pts.reduce((a, p) => a + p[0], 0), sy = pts.reduce((a, p) => a + p[1], 0);
  const sxx = pts.reduce((a, p) => a + p[0] * p[0], 0), sxy = pts.reduce((a, p) => a + p[0] * p[1], 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);          // kg per day
  if (!isFinite(slope)) return null;
  const intake = keys.reduce((a, x) => a + totals(x).kcal, 0) / keys.length;
  // The same share of your movement as your daily goal gives back (50% by default), so this correction and the
  // daily bonus don't both count it.
  const extra = moveOn() ? keys.reduce((a, x) => a + moveBonus(x), 0) / keys.length : 0;
  const tdee = Math.round((intake - slope * 7700) / 10) * 10;
  return { tdee, extra: Math.round(extra), base: tdee - extra, days: keys.length };
}
/* Your eat goal on your measured burn: it moves towards it by at most 50 kcal a week, so one odd week can't throw it
   off. The first time, it starts from what your goal was (including earlier adjustments at weigh-ins). */
/* Movement switched on or off (or another source) after Knabbel measured your burn: the measured number is worked out again
   for the new situation at once. Before, the bonus counted twice (or not at all) until the weekly step of 50 kcal had put
   it right. */
function rebaseBurn(){
  const P = S.profile; if (!P || !P.burn) return;
  const m = measureBurn(); if (!m) return;
  const F = calcTargets({ ...P, weight: calcWeight(), burn: null, adjust: 0 });
  const base = Math.round(clamp(m.base, F.tdee * 0.7, F.tdee * 1.3));
  Object.assign(P.burn, { base, target: base, measured: m.tdee, extra: m.extra, at: Date.now(), stepAt: Date.now() });
}
function updateBurn(){
  const P = S.profile; if (!P) return;
  const m = measureBurn(); if (!m) return;
  const F = calcTargets({ ...P, weight: calcWeight(), burn: null, adjust: 0 });     // the formula alone
  const target = Math.round(clamp(m.base, F.tdee * 0.7, F.tdee * 1.3));
  let B = P.burn;
  if (!B) { B = P.burn = { base: Math.round(F.tdee + (P.adjust || 0)), stepAt: 0 }; P.adjust = 0; }
  Object.assign(B, { measured: m.tdee, extra: m.extra, days: m.days, target, at: Date.now() });
  if (Date.now() - (B.stepAt || 0) >= 6.5 * 864e5 && Math.abs(target - B.base) >= 10) { B.base = Math.round(B.base + clamp(target - B.base, -50, 50)); B.stepAt = Date.now(); }
  retarget(); save();
}

