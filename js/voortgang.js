/* The Progress page: week budget, weight card and the scale explainer. */
/* ---------- progress ---------- */
/* A week summary from your own data: no AI needed. */
/* Your success recipe: the periods between weigh-ins where you lost most, compared with the rest. Which habits
   were clearly different then? Only shown once there are enough weigh-ins and logged days to say something. */
function successRecipe(){
  const ws = weightSeries(), periods = [];
  for (let i = 1; i < ws.length; i++) {
    const a = ws[i - 1], b = ws[i], d = daysBetween(a.date, b.date); if (d < 4 || d > 14) continue;
    const days = Array.from({ length: d }, (_, j) => shiftKey(a.date, j)).filter(fullDay); if (days.length < 3) continue;
    periods.push({ rate: (b.kg - a.kg) / d * 7, days });
  }
  if (periods.length < 4) return null;
  const P = S.profile, lose = !isGain(P.goal);
  periods.sort((x, y) => lose ? x.rate - y.rate : y.rate - x.rate);
  const n = Math.max(2, Math.floor(periods.length / 3)), best = periods.slice(0, n).flatMap(p => p.days), rest = periods.slice(n).flatMap(p => p.days);
  const mean = (ks, f) => ks.reduce((a, k) => a + f(k), 0) / ks.length;
  const clock = e => e.t && e.t % 60000 ? new Date(e.t).getHours() : null;
  const feats = [
    ['bp', k => day(k).entries.filter(e => e.meal === 'ontbijt').reduce((a, e) => a + (e.p || 0), 0), (b, r) => b - r >= 6, (b) => `je at een eiwitrijk ontbijt (± ${r0(b)} g eiwit)`],
    ['late', k => day(k).entries.filter(e => clock(e) != null && clock(e) >= 20).reduce((a, e) => a + e.kcal, 0), (b, r) => r - b >= 100, (b, r) => b < 30 ? `je at na 20:00 bijna niets (anders ± ${r0(r)} kcal)` : `je at na 20:00 minder (± ${r0(b)} kcal in plaats van ${r0(r)})`],
    ['water', k => fluidMl(k), (b, r) => b - r >= 300, (b) => `je dronk meer (± ${(r0(b / 100) / 10).toString().replace('.', ',')} liter per dag)`],
    ['snack', k => day(k).entries.filter(e => e.meal === 'snack').length, (b, r) => r - b >= 0.8, (b) => `je nam minder tussendoortjes (± ${String(r1(b)).replace('.', ',')} per dag)`],
    ['prot', k => totals(k).p, (b, r) => b - r >= 15, (b) => `je at meer eiwit (± ${r0(b)} g per dag)`],
    ['move', k => moveKcal(k), (b, r) => b - r >= 80, (b) => `je bewoog meer (± ${r0(b)} kcal per dag)`],
    ['score', k => dayScore(k)?.score || 0, (b, r) => b - r >= 0.7, (b) => `je at voedzamer (dagscore ± ${String(r1(b)).replace('.', ',')})`],
    ['kcal', k => totals(k).kcal - budget(k).kcal, (b, r) => lose ? r - b >= 120 : b - r >= 120, (b, r) => lose ? `je at minder (± ${r0(Math.abs(b))} kcal per dag ${b < 0 ? 'onder' : 'boven'} je eetdoel, anders ${r0(Math.abs(r))} ${r < 0 ? 'eronder' : 'erboven'})` : `je at meer (± ${r0(Math.abs(b))} kcal per dag ${b < 0 ? 'onder' : 'boven'} je eetdoel)`]
  ];
  const found = feats.map(([id, f, ok, say]) => { const b = mean(best, f), r = mean(rest, f); return ok(b, r) ? { id, text: say(b, r), gap: Math.abs(b - r) / (Math.abs(r) + 1) } : null; })
    .filter(Boolean).sort((x, y) => y.gap - x.gap).slice(0, 3);
  const bestRate = periods.slice(0, n).reduce((a, p) => a + p.rate, 0) / n;
  return found.length ? { found, n, rate: bestRate } : null;
}
function successHTML(){
  const R = successRecipe(); if (!R) return '';
  return `<details class="parts succes"><summary><span>🏆 Jouw succesrecept</span>${CHEV}</summary>
    <p style="margin:0 0 6px">In je ${R.n} beste weken (± ${kgStr(Math.abs(R.rate))} kg per week ${R.rate < 0 ? 'eraf' : 'erbij'}) deed je dit anders:</p>
    <ul>${R.found.map(f => `<li>${f.text}</li>`).join('')}</ul>
    <p class="note" style="padding-bottom:10px">Uit je eigen weegmomenten en wat je logde. Hoe meer weken, hoe beter het klopt.</p></details>`;
}
function weekInsightHTML(){
  const keys = Array.from({ length: 7 }, (_, i) => shiftKey(todayKey(), -i - 1)).filter(fullDay);
  if (keys.length < 3) return '';
  const prev = Array.from({ length: 7 }, (_, i) => shiftKey(todayKey(), -i - 8)).filter(fullDay);
  const avg = ks => ks.reduce((a, k) => a + totals(k).kcal, 0) / ks.length;
  const a = avg(keys), bud = keys.reduce((s, k) => s + budget(k).kcal, 0) / keys.length;
  const protDays = keys.filter(k => totals(k).p >= macroGoals(k).p * 0.9).length;
  const waterDays = keys.filter(k => fluidMl(k) >= waterGoal(k)).length;
  const scores = keys.map(k => [k, dayScore(k)]).filter(x => x[1]);
  const best = scores.sort((x, y) => y[1].score - x[1].score)[0];
  const src = new Map(); keys.forEach(k => day(k).entries.forEach(e => { const n = String(e.name || '').trim(); if (n) src.set(n, (src.get(n) || 0) + (e.kcal || 0)); }));
  const total = keys.reduce((s, k) => s + totals(k).kcal, 0) || 1;
  const top = [...src.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3);
  const row = (l, v) => `<div class="eq"><span>${l}</span><b class="num">${v}</b></div>`;
  return `<section class="card" aria-label="De week in het kort"><div class="row between"><h3>De week in het kort</h3><span class="note">${keys.length} volledige dagen</span></div>
    <div class="card eqs" style="background:var(--surface2)">
      ${row('Gemiddeld per dag', `${r0(a).toLocaleString('nl-NL')} kcal`)}
      ${prev.length >= 3 ? row('Vergeleken met de week ervoor', (dv => `${dv > 0 ? '+' : dv < 0 ? '−' : '±'}${Math.abs(dv).toLocaleString('nl-NL')} kcal`)(r0(a - avg(prev)))) : row('Dagen op rij gelogd', `${streak()}`)}
      ${row('Eiwitdoel gehaald', `${protDays} van ${keys.length} dagen`)}
    </div>
    <details class="more-rows"><summary>Meer cijfers ›</summary><div>
    <div class="card eqs" style="background:var(--surface2)">
      ${S.profile.burn && S.profile.burn.measured ? row('Jouw verbruik (gemeten)', `± ${S.profile.burn.measured.toLocaleString('nl-NL')} kcal`) : ''}
      ${prev.length >= 3 ? row('Dagen op rij gelogd', `${streak()}`) : ''}
      ${moveOn() && S.profile.moveGoal ? row('Beweegdoel gehaald', `${keys.filter(k => moveKcal(k) >= S.profile.moveGoal).length} van ${keys.length} dagen`) : S.meta.health.on ? row('Stappen per dag', r0(keys.reduce((x, k) => x + (day(k).move?.steps || 0), 0) / keys.length).toLocaleString('nl-NL')) : ''}
      ${row('Genoeg gedronken', `${waterDays} van ${keys.length} dagen`)}
      ${scores.length ? row('Gemiddelde dagscore', `${String(r1(scores.reduce((s, x) => s + x[1].score, 0) / scores.length)).replace('.', ',')}/10`) : ''}
      ${best ? row('Voedzaamste dag', `${shortDate(best[0])} · ${best[1].score}/10`) : ''}
    </div>
    ${top.length ? `<div class="eyebrow">Meeste kcal kwamen van</div><div class="ingr">${top.map(([n, kc]) => `<div class="row between"><span class="grow">${esc(n)}</span><span class="num muted">${r0(kc / total * 100)}%</span><span class="num" style="font-weight:700;min-width:72px;text-align:right">${r0(kc).toLocaleString('nl-NL')} kcal</span></div>`).join('')}</div>` : ''}
    ${successHTML()}
    </div></details>
  </section>`;
}
/* ---------- week budget: Monday to Sunday ----------
   What you eat less than your goal on a day stays yours for the rest of the week (and the other way round). Your
   weekly average, and so your pace, stays the same. Days you didn't (fully) log count as "on goal". */
function weekBudget(){
  const today = todayKey(), dow = (dateOf(today).getDay() + 6) % 7, base = S.profile.targets.kcal;
  const days = Array.from({ length: 7 }, (_, i) => { const k = shiftKey(today, i - dow), past = i < dow;
    const bud = i <= dow ? budget(k).kcal : base, eaten = i <= dow ? totals(k).kcal : 0, counts = past && fullDay(k) && eaten >= budget(k).base * 0.5;
    return { k, i, past, today: i === dow, bud, eaten, counts, diff: counts ? bud - eaten : 0 }; });
  const saved = days.reduce((a, x) => a + x.diff, 0), left = 7 - dow;
  const perDay = Math.round(base + saved / left), min = minKcal();
  return { days, saved: r0(saved), left, perDay: Math.max(min, perDay), low: perDay < min, base, total: days.reduce((a, x) => a + x.bud, 0),
    eaten: days.reduce((a, x) => a + (x.counts || x.today ? x.eaten : x.past ? x.bud : 0), 0), from: days[0].k, to: days[6].k };
}
/* Under the ring: what this week's budget means today, without changing the day goal. */
function weekLineHTML(){
  if (!firstLogKey()) return '';
  const W = weekBudget(), v = r0(Math.abs(W.saved)).toLocaleString('nl-NL');
  if (W.saved >= 50) return `<span class="wkline num">+${v} kcal gespaard deze week</span>`;
  if (W.saved <= -50) return `<span class="wkline num over">${v} kcal boven je weekbudget</span>`;
  return '';
}
function weekBudgetHTML(){
  if (!firstLogKey()) return '';
  const W = weekBudget(), fmt = v => r0(v).toLocaleString('nl-NL'), cap = 1.3;
  const d0 = dateOf(W.from), d6 = dateOf(W.to);
  const range = `${d0.getDate()}${d0.getMonth() !== d6.getMonth() ? ' ' + MONTHS[d0.getMonth()] : ''} – ${d6.getDate()} ${MONTHS[d6.getMonth()]}`;
  const cols = W.days.map(x => {
    const fill = x.past || x.today ? clamp(x.eaten / x.bud, 0, cap) : clamp(W.perDay / x.bud, 0, cap);
    const tol = Math.max(50, x.bud * 0.1), kind = !x.counts ? '' : x.diff < -tol ? 'meer' : x.diff > tol ? 'minder' : 'rond';
    const col = x.today ? 'var(--accent)' : !x.past ? 'color-mix(in srgb,var(--accent) 22%,transparent)' : !x.counts ? 'color-mix(in srgb,var(--ink) 18%,transparent)' : kind === 'meer' ? 'var(--c)' : kind === 'minder' ? 'var(--sky)' : 'var(--leaf)';
    const sub = x.today ? 'nu' : !x.past ? '' : !x.counts ? '–' : `${x.diff >= 0 ? '+' : '−'}${fmt(Math.abs(x.diff))}`;
    return `<div class="wkd${x.today ? ' now' : ''}${x.past || x.today ? '' : ' fut'}"${x.past || x.today ? ` data-barday="${x.k}" style="cursor:pointer"` : ''}><span class="wkl">${DAYS[dateOf(x.k).getDay()]}</span>
      <span class="wkt"><i style="height:${(fill / cap * 100).toFixed(1)}%;background:${col}"></i></span>
      <span class="wkv num${kind === 'meer' ? ' over' : kind === 'minder' ? ' less' : ''}">${sub}</span></div>`; }).join('');
  const days = W.left === 1 ? 'vandaag' : `vandaag t/m zondag`;
  const share = r0(W.perDay - W.base), head = W.saved >= 50 ? `+${fmt(W.saved)}` : W.saved <= -50 ? fmt(-W.saved) : 'Op koers';
  const sub = W.saved >= 50 ? 'kcal gespaard deze week' : W.saved <= -50 ? 'kcal boven je weekbudget' : 'je eet deze week volgens je doel';
  // What the saved (or extra) kcal mean for the days that are left: spread evenly over today up to and including Sunday.
  const per = `<b class="num">± ${fmt(W.perDay)} kcal</b> per dag`, sum = `je dagdoel ${fmt(W.base)} ${share >= 0 ? '+' : '−'} ${fmt(Math.abs(share))}`;
  const how = Math.abs(W.saved) < 50 ? `Blijf bij je dagdoel van ${fmt(W.base)} kcal.`
    : W.low ? `Haal het niet in door onder je minimum van ${fmt(minKcal())} kcal te eten: dan val je deze week gewoon iets minder af, en dat is oké.`
    : W.saved > 0 ? `Daardoor mag je ${days} ${per} eten (${sum}). Bijvoorbeeld voor iets extra's in het weekend.`
    : `Om het goed te maken eet je ${days} ${per} (${sum}).`;
  return `<section class="card weekbud" aria-label="Deze week">
    <div class="row between"><h3>Deze week</h3><span class="note num">${range}</span></div>
    <div class="wkhero"><span><b class="num" style="color:${W.saved >= 50 ? 'var(--leaf)' : W.saved <= -50 ? 'var(--warn-ink)' : 'var(--ink)'}">${head}</b><span class="note">${sub}</span></span></div>
    <p class="wkhow">${how}</p>
    <div class="wk" role="img" aria-label="Per dag: ${W.days.filter(x => x.counts).map(x => `${DAYS[dateOf(x.k).getDay()]} ${x.diff >= 0 ? 'gespaard' : 'erboven'} ${fmt(Math.abs(x.diff))}`).join(', ') || 'nog geen volledige dagen'}">${cols}</div>

    <div class="row wrap note" style="gap:12px"><span><b style="color:var(--leaf)">●</b> rond je doel</span><span><b style="color:var(--sky)">●</b> minder</span><span><b style="color:var(--c)">●</b> meer</span></div>
    <details class="infox"><summary><i aria-hidden="true">i</i>Hoe werkt het weekbudget?</summary><p class="note">Wat je op een dag minder eet dan je doel, mag je later in de week extra eten, en andersom. Je tempo blijft zo gelijk. Je dagdoel op Vandaag verandert niet. Dagen die je niet helemaal logt (of met minder dan de helft van je doel) tellen als volgens doel.</p></details>
  </section>`;
}
/* ---------- weight card: line chart with plan, goal, range and touch read-out ---------- */
let wRange = '3m', wPts = [], wOff = 0;   // wOff: how many periods you looked back
const W_RANGES = [['1w', 'Week', 7], ['1m', '1 mnd', 31], ['3m', '3 mnd', 92], ['6m', '6 mnd', 183], ['all', 'Alles', 0]];
/* Only the periods that show something new. A period looks back half its length, so "1 mnd" appears once your first
   weigh-in is more than half a week ago, "3 mnd" after half a month, and so on. The week is always there.
   If the chosen period isn't shown (yet), the largest one that is takes its place. */
function wRanges(all){
  const age = all.length ? daysBetween(all[0].date, todayKey()) : 0;
  return W_RANGES.filter((r, i) => i === 0 || age > W_RANGES[i - 1][2] / 2);
}
function wRangeNow(all){
  const list = wRanges(all);
  return list.some(r => r[0] === wRange) ? wRange : list[list.length - 1][0];
}
const weightSeries = () => [...S.meta.weights].sort((a, b) => a.date.localeCompare(b.date));
function niceStep(span){ for (const st of [0.2, 0.5, 1, 2, 5, 10]) if (span / st <= 5) return st; return 20; }
const BMI_BANDS = [
  [18.5, 'Ondergewicht', 'var(--sky)'], [25, 'Gezond gewicht', 'var(--leaf)'], [30, 'Overgewicht', 'var(--warn)'],
  [35, 'Obesitas klasse 1', 'var(--obese)'], [40, 'Obesitas klasse 2', 'var(--bad)'], [Infinity, 'Obesitas klasse 3', 'var(--bad)']
];
const bmiOf = kg => kg / (S.profile.height / 100) ** 2;
const bmiBand = b => BMI_BANDS.find(x => b < x[0]);
function bmiHTML(kg){
  const b = bmiOf(kg), band = bmiBand(b), lo = 15, hi = 40, pos = v => clamp((v - lo) / (hi - lo) * 100, 0, 100);
  const h2 = (S.profile.height / 100) ** 2;
  const goalB = S.profile.goalWeight ? bmiOf(S.profile.goalWeight) : null;
  const segs = [[lo, 18.5, 'var(--sky)'], [18.5, 25, 'var(--leaf)'], [25, 30, 'var(--warn)'], [30, 35, 'var(--obese)'], [35, hi, 'var(--bad)']];
  return `<details class="bmiline"><summary><span class="row" style="gap:8px"><b class="num">BMI ${String(r1(b)).replace('.', ',')}</b><span class="pill" style="${pillStyle(band[2])}">${band[1]}</span></span>${CHEV}</summary>
    <div class="bmi">
    <div class="bmibar" role="img" aria-label="BMI ${r1(b)}, ${band[1]}">
      ${segs.map(([a, z, c]) => `<i style="left:${pos(a)}%;width:${pos(z) - pos(a)}%;background:${c}"></i>`).join('')}
      ${goalB ? `<span class="goal" style="left:${pos(goalB)}%" title="Streefgewicht"></span>` : ''}
      <span class="me" style="left:${pos(b)}%"></span>
    </div>
    <div class="bmiticks num">${[18.5, 25, 30, 35].map(v => `<span style="left:${pos(v)}%">${String(v).replace('.', ',')}</span>`).join('')}</div>
    <p class="note">Gezond gewicht voor jouw lengte: ${r0(18.5 * h2)} tot ${r0(24.9 * h2)} kg.${goalB ? ' Het streepje is je streefgewicht.' : ''}</p>
  </div></details>`;
}
/* The weekly weigh-in, inside the weight card right above "Gewicht vandaag": when the next one is, and how the last ones went. */
function weighInsHTML(){
  const next = nextCheckinKey(), due = dueWeek(), cis = [...S.meta.checkins].sort((a, b) => b.week - a.week), shown = ciAll ? cis : cis.slice(0, 3);
  return `<div class="weighin">
    <div class="row between"><span class="eyebrow">📅 Weegmoment</span>${due ? '<span class="pill warn">Nu</span>' : next ? `<span class="note">volgende ${shortDate(next)}</span>` : ''}</div>
    ${!firstLogKey() ? '<p class="note">Start na je eerste gelogde maaltijd, daarna elke week.</p>'
      : due ? `<p class="note">Vul hieronder je gewicht van vandaag in: dat is je weegmoment.</p>` : ''}
    ${shown.length ? `<div>${shown.map(c => `<div class="ci"><span class="grow"><b>Week ${c.week}</b> <span class="note num">${kgStr(c.kg)} kg (schema ${kgStr(c.expected)})</span></span><span class="pill ${c.status}">${c.status === 'good' ? 'Op schema' : c.status === 'bad' ? 'Achter' : 'Let op'}</span></div>`).join('')}</div>` : ''}
    ${cis.length > 3 ? `<button class="add-line" data-act="ci-toggle" style="min-height:32px;padding:0">${ciAll ? 'Minder tonen' : `Alle ${cis.length} weegmomenten`}</button>` : ''}
  </div>`;
}
/* ---------- the scale explainer ----------
   Why did today's weight go up or down? From your own data since the last weigh-in: how much real fat that could be
   (kcal eaten minus burned, 7700 kcal per kg), and what else moves the scale: carbs (stored with about 3 g water
   per gram), salty food, a short night, a hard workout, a late meal. Most day-to-day changes are water and food
   that is still on its way, not fat. */
const SALTY_RE = /pizza|chips|friet|patat|kroket|frikandel|bitterbal|snack|chinees|sushi|soja|ramen|noedel|bouillon|worst|salami|bacon|spek|haring|ansjovis|olijven|zoutjes|nootjes gezouten|borrel|döner|kebab|shoarma|burger|hamburger|nacho|tortilla chips/i;
function scaleWhy(){
  const ws = weightSeries(), T = todayKey(), now = ws.find(w => w.date === T); if (!now) return null;
  const prev = [...ws].reverse().find(w => w.date < T && daysBetween(w.date, T) <= 14); if (!prev) return null;
  const delta = Math.round((now.kg - prev.kg) * 10) / 10; if (Math.abs(delta) < 0.3) return null;
  const P = S.profile, y = shiftKey(T, -1), up = delta > 0;
  // real fat: what you ate minus what you burned, on the fully logged days since the last weigh-in
  let surplus = 0;
  for (let k = prev.date; k < T; k = shiftKey(k, 1)) if (fullDay(k)) surplus += totals(k).kcal - (budget(k).kcal - P.targets.change);
  const fat = Math.round(surplus / 7.7) / 1000;                     // kg
  const past = Array.from({ length: 14 }, (_, i) => shiftKey(y, -i - 1)).filter(fullDay);
  const avg = f => past.length ? past.reduce((a, k) => a + f(k), 0) / past.length : null;
  const reasons = [], tY = totals(y), avgC = avg(k => totals(k).c), avgM = avg(k => moveKcal(k));
  if (fullDay(y) && avgC != null) {
    if (up && tY.c > avgC * 1.3 && tY.c - avgC > 40) reasons.push(`Gisteren veel koolhydraten (${r0(tY.c)} g, normaal ± ${r0(avgC)} g). Je lichaam slaat die op met water: zo'n 3 gram vocht per gram.`);
    if (!up && tY.c < avgC * 0.7 && avgC - tY.c > 40) reasons.push(`Gisteren weinig koolhydraten (${r0(tY.c)} g, normaal ± ${r0(avgC)} g): je lichaam raakt dan wat opgeslagen vocht kwijt.`);
  }
  const salty = day(y).entries.filter(e => SALTY_RE.test(e.name || '') || (e.items || []).some(i => SALTY_RE.test(i.name || ''))).map(e => e.name);
  if (up && salty.length) reasons.push(`Gisteren iets zouts (${esc(salty.slice(0, 2).join(', ').toLowerCase())}). Zout houdt een dag of twee extra vocht vast.`);
  const sl = (day(T).move || {}).sleep || 0;
  if (up && sl > 0 && sl < 360) reasons.push(`Korte nacht (${hmin(sl)}). Door het stresshormoon houdt je lichaam dan meer vocht vast.`);
  if (up && avgM != null && moveKcal(y) > Math.max(250, avgM * 1.5)) reasons.push('Gisteren flink bewogen. Je spieren houden even extra vocht vast om te herstellen. Dat is juist goed!');
  const lastY = day(y).entries.filter(e => !e.pending && e.t && e.t % 60000).sort((a, b) => b.t - a.t)[0];
  if (up && lastY && new Date(lastY.t).getHours() >= 21) reasons.push(`Laat gegeten (${hm(new Date(lastY.t))}): dat zit vanochtend nog in je buik.`);
  if (!up && avgM != null && moveKcal(y) > Math.max(250, avgM * 1.5)) reasons.push('Gisteren flink bewogen en gezweet: je bent ook wat vocht kwijt.');
  if (Math.abs(fat) >= 0.05) reasons.unshift(`Echt ${fat > 0 ? 'erbij' : 'eraf'} aan vet: ± ${Math.abs(fat) < 1 ? r0(Math.abs(fat) * 1000 / 10) * 10 + ' gram' : kgStr(Math.abs(fat)) + ' kg'} (wat je at tegenover wat je verbrandde${daysBetween(prev.date, T) > 1 ? ` sinds ${shortDate(prev.date)}` : ''}).`);
  const rest = Math.round((delta - fat) * 10) / 10;
  const head = up
    ? (Math.abs(rest) >= 0.3 ? `Vooral vocht en eten dat nog in je buik zit, geen vet.` : `Dit klopt ongeveer met wat je at.`)
    : (Math.abs(rest) >= 0.3 && Math.abs(fat) < Math.abs(delta) * 0.6 ? `Mooi! Een deel is vocht, dat kan morgen weer schommelen.` : `Mooi, dit is echt resultaat.`);
  const tr = trendNow(), sl28 = weightSlope();
  return { delta, prev, head, reasons: reasons.slice(0, 4), fat,
    trend: sl28 != null && P.goal === 'lose' ? (sl28 < 0 ? `Je trend gaat gewoon de goede kant op: ${kgStr(Math.abs(sl28 * 7))} kg per week eraf.` : 'Je trend staat de laatste weken stil: kijk ook even naar je porties en beweging.') : tr != null ? `Je trendgewicht is ${kgStr(tr)} kg.` : '' };
}
function scaleWhyHTML(){
  const W = scaleWhy(); if (!W) return '';
  const sign = W.delta > 0 ? '+' : '−';
  return `<details class="parts scalewhy"${W.delta > 0 ? ' open' : ''}><summary><span>🔍 Waarom ${sign}${kgStr(Math.abs(W.delta))} kg? <span class="note">sinds ${shortDate(W.prev.date)}</span></span>${CHEV}</summary>
    <p style="margin:0 0 6px"><b>${W.head}</b></p>
    ${W.reasons.length ? `<ul>${W.reasons.map(r => `<li>${r}</li>`).join('')}</ul>` : ''}
    <p class="note" style="padding-bottom:10px">${W.trend ? W.trend + ' ' : ''}Je gewicht kan van dag tot dag 1 à 2 kg schommelen door vocht en wat er in je buik zit. Kijk vooral naar je trend.</p>
  </details>`;
}
/* All weigh-ins, newest first, each one to change or remove (a typo at the start makes "since start" wrong for good).
   The one marked "start" is what "since start", the goal bar and the schedule count from. */
let wEdit = null;
/* After changing or removing a weigh-in: your profile weight follows the newest one, and everything is worked out again. */
function afterWeightsChange(){
  const last = weightSeries().slice(-1)[0];
  if (last) S.profile.weight = last.kg;
  retarget(); updateBurn(); save(); render();
}
function weightsSheet(){
  const ws = weightSeries().reverse(), startKey = (() => { const f = firstLogKey(); const asc = weightSeries(); const b = asc.filter(w => w.date <= (f || todayKey())); return (b.length ? b[b.length - 1] : asc[0] || {}).date; })();
  sheet('Wegingen aanpassen', `
    <p class="muted">Tik op een weging om hem aan te passen. Het gewicht met <b>start</b> erbij is waar "sinds start", je voortgang en je schema mee rekenen.</p>
    <div class="card wlist">${ws.map(w => w.date === wEdit ? `
      <form class="wrow editing" id="wEditForm" data-date="${w.date}"><span class="grow"><b>${esc(prettyDay(w.date))}</b>${w.date === startKey ? '<span class="pill good">start</span>' : ''}</span>
        <div class="row"><input id="we-kg" type="text" inputmode="decimal" autocomplete="off" value="${kgStr(w.kg)}" aria-label="Gewicht op ${esc(prettyDay(w.date))} in kg">
        <button class="btn" type="submit">Opslaan</button><button class="icon-btn" type="button" data-act="w-del" data-date="${w.date}" aria-label="Weging verwijderen">✕</button></div></form>`
      : `<button class="wrow" data-wedit="${w.date}"><span class="grow">${esc(prettyDay(w.date))}${w.date === startKey ? '<span class="pill good">start</span>' : ''}</span><b class="num">${kgStr(w.kg)} kg</b><span class="chev" aria-hidden="true">›</span></button>`).join('')}</div>
    <button class="btn block ghost" data-act="close">Klaar</button>`, true);
  const inp = $('#we-kg'); if (inp) { inp.focus(); inp.select(); setTimeout(() => inp.closest('.wrow')?.scrollIntoView({ block: 'nearest' }), 350); }   // in view above the keyboard
}
function weightCardHTML(){
  const P = S.profile, all = weightSeries(), last = all[all.length - 1];
  const start = firstLogKey() ? startWeight() : all[0]?.kg;
  const diff = last && start != null ? last.kg - start : 0;
  const fromKey = firstLogKey() || all[0]?.date;
  const weeks = last && fromKey ? daysBetween(fromKey, last.date) / 7 : 0;
  const perWeek = weeks >= 1 ? diff / weeks : null;
  const dirGood = P.goal === 'lose' ? diff <= 0 : isGain(P.goal) ? diff >= 0 : Math.abs(diff) <= 1;
  const sign = n => (n > 0.04 ? '+' : n < -0.04 ? '−' : '') + Math.abs(n).toFixed(1).replace('.', ',');
  const kgNow = last ? last.kg : P.weight;
  let goalBar = '';
  if (P.goalWeight && P.goal !== 'maintain' && last && start != null && start !== P.goalWeight) {
    const pct = clamp((last.kg - start) / (P.goalWeight - start), 0, 1);
    const reached = P.goal === 'lose' ? last.kg <= P.goalWeight : last.kg >= P.goalWeight;
    goalBar = `<div style="display:flex;flex-direction:column;gap:6px">
      <div class="bar" style="height:10px"><i style="width:${pct * 100}%;background:var(--leaf)"></i></div>
      <p class="note num">${reached ? '<b style="color:var(--leaf)">Streefgewicht bereikt!</b>' : `${r0(pct * 100)}% op weg naar ${kgStr(P.goalWeight)} kg · nog ${kgStr(Math.abs(P.goalWeight - last.kg))} kg`}</p></div>`;
  }
  return `<section class="card" aria-label="Gewicht">
    <div class="row between" style="align-items:flex-end">
      <div><div class="eyebrow">Gewicht</div><b class="num" style="font-family:var(--display);font-size:32px;line-height:1.1">${kgStr(kgNow)} <span style="font-size:20px">kg</span></b>${trendNow() != null ? `<button class="trendinfo num" data-act="explain-trend" aria-label="Trend ${kgStr(trendNow())} kg, uitleg">trend ${kgStr(trendNow())} kg <i aria-hidden="true">i</i></button>` : ''}</div>
      ${last && diff !== 0 ? `<div style="text-align:right"><span class="pill ${dirGood ? 'good' : 'bad'} num">${sign(diff)} kg</span><div class="note num">sinds start${perWeek != null ? ` · ${sign(perWeek)} kg per week` : ''}</div></div>` : ''}
    </div>
    ${goalBar}
    ${scaleWhyHTML()}
    ${goalForecast() ? `<div class="seg" role="group" aria-label="Grafiek of cijfers">${[['chart', 'Grafiek'], ['stats', 'Cijfers']].map(([id, l]) => `<button data-wview="${id}" aria-pressed="${wView === id}">${l}</button>`).join('')}</div>` : ''}
    ${wView === 'stats' && goalForecast() ? weightStatsHTML()
      : all.length >= 2 ? `<div class="seg" role="group" aria-label="Periode">${wRanges(all).map(([id, l]) => `<button data-wrange="${id}" aria-pressed="${wRangeNow(all) === id}">${l}</button>`).join('')}</div>
      ${weightChartHTML(all)}` : `<p class="muted">Na twee keer wegen zie je hier een grafiek.</p>`}
    ${bmiHTML(kgNow)}
  </section>
  <section class="card" aria-label="Wegen">
    ${all.length ? `<button class="linkline" data-act="weights-open"><b>Wegingen aanpassen</b><span class="row" style="gap:8px">${start != null && firstLogKey() ? `<span class="note num">start ${kgStr(start)} kg</span>` : ''}<span class="chev" aria-hidden="true">›</span></span></button>` : ''}
    ${weighInsHTML()}
    <form class="ask" id="weightForm"><input id="w-kg" type="text" inputmode="decimal" autocomplete="off" placeholder="${dueWeek() ? `Week ${dueWeek()}: je gewicht (kg)` : 'Gewicht vandaag (kg)'}" aria-label="Gewicht vandaag in kg" required><button class="btn small${dueWeek() ? '' : ' outline'}" type="submit">Opslaan</button></form>
    <details class="weightips"><summary><span>⚖️ Zo weeg je het eerlijkst</span>${CHEV}</summary>
      <ul>
        <li><b>'s Ochtends</b>, na het plassen en vóór je iets eet of drinkt.</li>
        <li><b>Altijd hetzelfde:</b> zonder kleding (of steeds dezelfde lichte kleding), dezelfde weegschaal, op een harde vlakke vloer. Op tapijt klopt het niet.</li>
        <li><b>Liefst elke dag</b> of een paar keer per week: dan maakt ${esc(S.meta.pet.name)} er een trend van. Minstens op je weegmoment.</li>
        <li><b>Beter niet</b> direct na sporten, sauna of een grote maaltijd.</li>
      </ul>
      <p class="note">Een uitschieter van 1 à 2 kg is normaal: door zout of veel koolhydraten, flink sporten, je cyclus, een korte nacht of hoe vol je darmen zitten. Kijk naar de trend over weken, niet naar één ochtend.</p>
    </details>
  </section>`;
}
/* Trend weight: for every day, the straight line that fits your weigh-ins of the 2 weeks up to that day best, read off at
   that day. One heavy morning moves it only a little, but a steady drop shows straight away (an average over days
   lagged a week or more behind). Only used when you weigh often (4+ times in 2 weeks). */
/* Worked out once per set of weigh-ins and remembered: one page asks for it about ten times, and with two years of
   weigh-ins working it out took a third of a second each time. The 2-week window slides along the sorted weigh-ins. */
let trendMemo = null;
function trendSeries(){
  const ws = weightSeries(); if (ws.length < 2) return [];
  const key = ws.map(w => w.date + ':' + w.kg).join();
  if (trendMemo && trendMemo.key === key) return trendMemo.out;
  const d0 = ws[0].date, day = ws.map(w => daysBetween(d0, w.date)), out = [];
  let lo = 0, hi = 0;
  for (let x = 0, k = d0; x <= day[day.length - 1]; x++, k = shiftKey(k, 1)) {
    while (hi < ws.length && day[hi] <= x) hi++;
    while (day[lo] < x - 13) lo++;
    const n = hi - lo;
    if (n < 2) { out.push({ date: k, kg: n ? ws[lo].kg : out.length ? out[out.length - 1].kg : ws[0].kg }); continue; }   // a gap of 2 weeks: the line stays where it was
    let mx = 0, my = 0; for (let i = lo; i < hi; i++) { mx += day[i] - x; my += ws[i].kg; } mx /= n; my /= n;
    let sxx = 0, sxy = 0; for (let i = lo; i < hi; i++) { const dx = day[i] - x - mx; sxx += dx * dx; sxy += dx * (ws[i].kg - my); }
    out.push({ date: k, kg: my - (sxx ? sxy / sxx : 0) * mx });
  }
  trendMemo = { key, out };
  return out;
}
const useTrend = () => weightSeries().filter(w => daysBetween(w.date, todayKey()) <= 14).length >= 4;
const trendNow = () => { const s = useTrend() ? trendSeries() : []; return s.length ? s[s.length - 1].kg : null; };
/* The trend as it would be without your newest weigh-in, read off at today. One heavy (or light) morning can pull the
   end of the line a lot when you weigh only a few times; advice that would change because of that one weigh-in only
   changes once the next weigh-in confirms it. */
function trendWithoutNewest(){
  const ws = weightSeries(); if (!useTrend() || ws.length < 4) return null;
  const k = todayKey(), win = ws.slice(0, -1).filter(w => daysBetween(w.date, k) <= 13);
  if (win.length < 3) return null;
  const xs = win.map(w => -daysBetween(w.date, k)), ys = win.map(w => w.kg), n = win.length;
  const mx = xs.reduce((a, v) => a + v, 0) / n, my = ys.reduce((a, v) => a + v, 0) / n;
  const sxx = xs.reduce((a, v) => a + (v - mx) ** 2, 0), slope = sxx ? xs.reduce((a, v, i) => a + (v - mx) * (ys[i] - my), 0) / sxx : 0;
  return my - slope * mx;
}
/* Is your newest weigh-in an outlier? Only then the advice and the pace leave it out for now. It has to be 0.5 kg or
   more off the line of the ones before AND a jump of 0.5 kg or more from your previous weigh-in, the same way. Weighing
   the same as last time is never an outlier: after a fast first week the line points steeply down, and a steady
   morning would otherwise look "too heavy". */
function newestIsSpike(){
  const ws = weightSeries(), prev = trendWithoutNewest(); if (prev == null) return false;
  const last = ws[ws.length - 1], before = ws[ws.length - 2], off = last.kg - prev, jump = last.kg - before.kg;
  return daysBetween(last.date, todayKey()) <= 1 && Math.abs(off) >= 0.5 && Math.abs(jump) >= 0.5 && Math.sign(off) === Math.sign(jump);
}
/* The trend in plain words, with your own numbers. */
function trendExplainHTML(){
  const ws = weightSeries(), last = ws[ws.length - 1], tr = trendNow(), lose = S.profile.goal === 'lose';
  const gap = tr != null && last ? r1(tr - last.kg) : 0;
  return `<p>Je gewicht schommelt per dag 1 à 2 kg door vocht, zout en wat er nog in je darmen zit. De <b>trend</b> haalt die schommelingen eruit, zodat je ziet welke kant het echt op gaat.</p>
    ${tr != null && last ? `<div class="card eqs"><div class="eq"><span>Laatste weging (${shortDate(last.date)})</span><b class="num">${kgStr(last.kg)} kg</b></div><div class="eq"><span>Trend</span><b class="num">${kgStr(tr)} kg</b></div></div>` : ''}
    <p class="muted">De trend is de rechte lijn die het best past bij al je wegingen van de afgelopen 2 weken. Eén zware ochtend verandert hem maar een klein beetje, want de andere dagen tellen ook mee. Ga je gestaag omlaag, dan gaat de trend direct mee.</p>
    ${Math.abs(gap) >= 0.3 ? `<p class="muted">${gap > 0
      ? `Je trend ligt ${kgStr(gap)} kg boven je laatste weging. Was je vanochtend wat lichter dan normaal, dan telt dat maar een beetje mee; blijf je zo laag, dan zakt de trend mee.`
      : `Je trend ligt ${kgStr(-gap)} kg onder je laatste weging. Een uitschieter omhoog (zout, een late maaltijd) telt maar een beetje mee; blijft je gewicht hoger, dan gaat de trend mee.`}</p>` : ''}
    <p class="note">Je ziet de trend als je de afgelopen 2 weken minstens 4 keer hebt gewogen. Weeg je minder vaak, dan zou hij te traag meebewegen.</p>
    <button class="btn block" data-act="close">Oké</button>`;
}
function weightChartHTML(all){
  const rng = wRangeNow(all), days = (W_RANGES.find(r => r[0] === rng) || [])[2] || 0, week = rng === '1w';
  /* The window is the whole period. It starts at your first weigh-in, so at first today is on the left; each day it
     moves a bit to the right until it reaches the middle, and from then on the window moves along with today.
     Left of today is what you weighed, right of it the schedule towards your goal. Example for the week: start on
     Monday, and from Thursday on today stays in the middle (3 days back, 3 days ahead). */
  const today = todayKey(), first = all[0].date;
  const D = days || Math.max(7, 2 * daysBetween(first, today) + 1), back = Math.floor((D - 1) / 2);
  let k0 = first > shiftKey(today, -back) ? first : shiftKey(today, -back);
  // Looking back: the whole window moves one period at a time, but never before your first weigh-in.
  const maxOff = k0 > first ? Math.ceil(daysBetween(first, k0) / D) : 0;
  wOff = Math.min(wOff, maxOff);
  if (wOff) { k0 = shiftKey(k0, -wOff * D); if (k0 < first) k0 = first; }
  let kEnd = shiftKey(k0, D - 1);
  const upTo = kEnd < today ? kEnd : today;
  let vis = all.filter(w => w.date >= k0 && w.date <= upTo);
  const before = all.filter(w => w.date < k0), prev = before[before.length - 1];
  if (!vis.length && prev) { k0 = prev.date; kEnd = shiftKey(k0, D - 1); vis = [prev]; }   // no weigh-in in this window: start at the last one
  const span = Math.max(1, D - 1), next = wOff ? all.find(w => w.date > kEnd) : null;
  // the one before the window lets the line run in from the edge, and when you look back the next one lets it run out
  const pts = [...(prev && vis[0] !== prev ? [prev] : []), ...vis, ...(next ? [next] : [])];
  const W = 340, H = 210, l = 38, r = 14, t = 18, b = 26;
  const f = firstLogKey();
  const planFrom = f && f > k0 ? f : k0;
  // The schedule as a few points, because it flattens once it reaches your goal weight.
  const expAt = expectedFn();
  const plan = f && planFrom <= kEnd ? Array.from({ length: 9 }, (_, i) => { const k = shiftKey(planFrom, Math.round(daysBetween(planFrom, kEnd) * i / 8)); return [k, expAt(k)]; }) : null;
  const vals = (vis.length >= 2 ? vis : pts).map(p => p.kg).concat(plan ? plan.map(p => p[1]) : []);
  let mn = Math.min(...vals), mx = Math.max(...vals);
  const goal = S.profile.goalWeight;
  // The week zooms in on the ups and downs, so the goal weight only stretches the scale on longer periods.
  if (goal && !week && (rng === 'all' || (goal >= mn - 2 && goal <= mx + 2))) { mn = Math.min(mn, goal); mx = Math.max(mx, goal); }
  if (mx - mn < (week ? 0.6 : 1)) { const mid = (mx + mn) / 2, half = week ? 0.3 : 0.5; mn = mid - half; mx = mid + half; }
  const step = niceStep(mx - mn);
  const pad = week ? 0.1 : 0.2;
  mn = Math.floor((mn - pad) / step + 1e-9) * step; mx = Math.ceil((mx + pad) / step - 1e-9) * step;
  const px = week ? 16 : 0;                                         // the week gets room for its day labels at the edges
  const X = k => l + px + (W - l - r - 2 * px) * (daysBetween(k0, k) / span);
  const Y = v => t + (H - t - b) * (1 - (v - mn) / (mx - mn));
  const ticks = []; for (let v = mn; v <= mx + 1e-9; v += step) ticks.push(r1(v));
  const xt = week ? Array.from({ length: span + 1 }, (_, i) => shiftKey(k0, i)) : [0, 1 / 3, 2 / 3, 1].map(fr => shiftKey(k0, Math.round(span * fr)));
  const lab = k => { const x = dateOf(k); return week ? DAYS[x.getDay()] + ' ' + x.getDate() : x.getDate() + ' ' + MONTHS[x.getMonth()]; };
  // The trend is worked out before the points, so tapping a weigh-in also shows the trend of that day.
  const trend = useTrend() ? trendSeries().filter(p => p.date >= pts[0].date && p.date <= today) : [];
  const trendAt = new Map(trend.map(p => [p.date, p.kg]));
  const all2 = pts.map(p => ({ x: X(p.date), y: Y(p.kg), date: p.date, kg: p.kg, plan: f && p.date >= f ? expAt(p.date) : null,
    trend: trendAt.has(p.date) ? trendAt.get(p.date) : null, ty: trendAt.has(p.date) ? Y(trendAt.get(p.date)) : null }));
  wPts = all2.filter(p => p.date >= k0 && p.date <= kEnd);          // only what you can see can be tapped
  const line = all2.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const lastP = wPts[wPts.length - 1];
  const showDots = wPts.length <= 40;
  const xT = X(today), seeToday = today >= k0 && today <= kEnd;
  // Your own pace: from your weight now, the way your weigh-ins of the last 4 weeks are going, up to your goal.
  const F = seeToday ? goalForecast() : null, slope = F && F.how === 'trend' ? paceSlope() : null;
  // An outlier as newest weigh-in gets a hollow dot: it is shown, but doesn't count in the advice yet.
  const spikeDot = seeToday && lastP.date === all[all.length - 1].date && newestIsSpike();
  const pace = slope != null ? (() => { const v0 = (spikeDot ? trendWithoutNewest() : null) ?? trendNow() ?? all[all.length - 1].kg, days = daysBetween(today, kEnd);
    let dEnd = days; if (goal && slope) { const toGoal = (goal - v0) / slope; if (toGoal > 0 && toGoal < dEnd) dEnd = toGoal; }
    return dEnd > 0 ? [[X(today), Y(v0)], [X(today) + (X(kEnd) - X(today)) * dEnd / Math.max(1, days), Y(v0 + slope * dEnd)]] : null; })() : null;
  const goalOut = goal && (goal < mn || goal > mx);
  const fmtD = k => { const x = dateOf(k); return x.getDate() + ' ' + MONTHS[x.getMonth()]; };
  const nav = maxOff ? `<div class="wnav"><button class="btn small ghost" data-act="w-prev" ${wOff >= maxOff ? 'disabled' : ''} aria-label="Eerdere periode">‹</button>
    <span class="num">${fmtD(k0)} – ${fmtD(kEnd)}</span>
    ${wOff ? `<button class="add-line" data-act="w-today">Vandaag</button>` : ''}<button class="btn small ghost" data-act="w-next" ${wOff ? '' : 'disabled'} aria-label="Latere periode">›</button></div>` : '';
  return `${nav}<div class="wchart" style="position:relative" data-wswipe>
    <svg class="chart" data-wchart viewBox="0 0 ${W} ${H}" role="img" aria-label="Lijngrafiek van je gewicht, van ${kgStr(wPts[0].kg)} kg op ${lab(wPts[0].date)} naar ${kgStr(lastP.kg)} kg op ${lab(lastP.date)}. Rechts van vandaag staat je schema." style="touch-action:pan-y">
      <defs><linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".28"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
      ${ticks.map(v => `<line x1="${l}" x2="${W - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${l - 6}" y="${Y(v) + 3.5}" text-anchor="end">${kgStr(v)}</text>`).join('')}
      <defs><clipPath id="wclip"><rect x="${l}" y="0" width="${W - l - r}" height="${H}"/></clipPath></defs>
      ${seeToday && xT < W - r - 1 ? `<rect x="${xT}" y="${t}" width="${W - r - xT}" height="${H - t - b}" fill="var(--ink)" opacity=".045"/>` : ''}
      ${seeToday ? `<line x1="${xT}" x2="${xT}" y1="${t}" y2="${H - b}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="3 3" opacity=".5"/>` : ''}
      ${xt.map((k, i) => (seeToday && k === today) || (seeToday && !week && Math.abs(X(k) - xT) < 44) ? '' : `<text x="${X(k)}" y="${H - 7}" text-anchor="${week ? 'middle' : i === 0 ? 'start' : i === xt.length - 1 ? 'end' : 'middle'}">${lab(k)}</text>`).join('')}
      ${!seeToday ? '' : (() => { // today's date on an orange tag, kept inside the chart
        const txt = lab(today), w = Math.round(txt.length * 6.5 + 10), cx = clamp(xT, l + w / 2 - 6, W - w / 2);
        return `<rect x="${(cx - w / 2).toFixed(1)}" y="${H - 21}" width="${w}" height="19" rx="7" fill="var(--accent)"/><text x="${cx.toFixed(1)}" y="${H - 7}" text-anchor="middle" style="fill:var(--accent-ink);font-weight:700">${txt}</text>`; })()}
      ${goal && !goalOut ? `<line x1="${l}" x2="${W - r}" y1="${Y(goal)}" y2="${Y(goal)}" stroke="var(--leaf)" stroke-width="1.5" opacity=".7"/><text x="${W - r}" y="${Y(goal) - 5}" text-anchor="end" style="fill:var(--leaf)">streef ${kgStr(goal)}</text>` : ''}
      ${plan ? `<polyline points="${plan.map(([k, v]) => `${X(k).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--leaf)" stroke-width="2" stroke-dasharray="6 5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
      ${pace ? `<line x1="${pace[0][0].toFixed(1)}" y1="${pace[0][1].toFixed(1)}" x2="${pace[1][0].toFixed(1)}" y2="${pace[1][1].toFixed(1)}" stroke="var(--accent)" stroke-width="2" stroke-dasharray="2 4" stroke-linecap="round" clip-path="url(#wclip)"/>` : ''}
      <g clip-path="url(#wclip)"><polygon points="${all2[0].x.toFixed(1)},${H - b} ${line} ${lastP.x.toFixed(1)},${H - b}" fill="url(#wfill)" ${trend.length ? 'opacity=".5"' : ''}/>
      <polyline class="wl" pathLength="1" points="${line}" fill="none" stroke="var(--accent)" stroke-width="${trend.length ? 1.5 : 2.5}" stroke-linejoin="round" stroke-linecap="round" ${trend.length ? 'opacity=".45"' : ''}/>
      ${trend.length ? `<polyline class="wl" pathLength="1" points="${trend.map(p => `${X(p.date).toFixed(1)},${Y(p.kg).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" opacity=".8"/>` : ''}</g>
      ${showDots ? wPts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`).join('') : ''}
      ${spikeDot ? `<circle cx="${lastP.x}" cy="${lastP.y}" r="6" fill="var(--surface)" stroke="var(--accent)" stroke-width="2.5" stroke-dasharray="3 2.4"/>`
        : `<circle cx="${lastP.x}" cy="${lastP.y}" r="6" fill="var(--accent)" stroke="var(--surface)" stroke-width="2.5"/>`}
      <text x="${Math.min(lastP.x, W - r - 20)}" y="${lastP.y - 11}" text-anchor="middle" style="fill:var(--ink);font-size:12px;font-weight:700;paint-order:stroke;stroke:var(--surface);stroke-width:4px;stroke-linejoin:round">${kgStr(lastP.kg)}</text>
      <line data-wcross x1="0" x2="0" y1="${t}" y2="${H - b}" stroke="var(--ink)" stroke-width="1" opacity="0"/>
      <circle data-wdot r="6" fill="none" stroke="var(--ink)" stroke-width="2" opacity="0"/>
      <circle data-wtdot r="4.5" fill="var(--ink)" stroke="var(--surface)" stroke-width="2" opacity="0"/>
    </svg>
    <div data-wtip class="wtip" hidden></div>
  </div>
  <div class="row wrap note" style="gap:12px"><span><b style="color:var(--accent)">●</b> gewicht</span><span><b aria-hidden="true">┆</b> vandaag</span>${useTrend() ? '<span><i class="legend-line trend" aria-hidden="true"></i>trend</span>' : ''}${plan ? '<span><b style="color:var(--leaf)">- -</b> schema</span>' : ''}${pace ? '<span><b style="color:var(--accent)">··</b> jouw tempo</span>' : ''}${goal && !goalOut ? '<span><b style="color:var(--leaf)">—</b> streef</span>' : ''}${spikeDot ? '<span><b style="color:var(--accent)">◌</b> uitschieter, telt nog niet mee</span>' : ''}</div>`;
}
/* Touch/hover read-out: snap to the nearest weigh-in. */
function wScrub(e){
  const svg = e.target.closest && e.target.closest('[data-wchart]'); if (!svg || !wPts.length) return;
  const box = svg.getBoundingClientRect(), vx = (e.clientX - box.left) / box.width * 340;
  let best = wPts[0]; for (const p of wPts) if (Math.abs(p.x - vx) < Math.abs(best.x - vx)) best = p;
  const cross = svg.querySelector('[data-wcross]'), dot = svg.querySelector('[data-wdot]'), tdot = svg.querySelector('[data-wtdot]'), tip = svg.parentElement.querySelector('[data-wtip]');
  cross.setAttribute('x1', best.x); cross.setAttribute('x2', best.x); cross.setAttribute('opacity', '.35');
  dot.setAttribute('cx', best.x); dot.setAttribute('cy', best.y); dot.setAttribute('opacity', '1');
  // The trend of that day as a dark dot on the trend line, so you see which value belongs to which line.
  if (tdot) { tdot.setAttribute('opacity', best.trend != null ? '1' : '0'); if (best.trend != null) { tdot.setAttribute('cx', best.x); tdot.setAttribute('cy', best.ty); } }
  const dp = best.plan != null ? best.kg - best.plan : null;
  const k1 = n => Math.abs(n).toFixed(1).replace('.', ',');
  tip.innerHTML = `<b>${k1(best.kg)} kg</b><span>${shortDate(best.date)}</span>${best.trend != null ? `<span>trend ${k1(best.trend)} kg</span>` : ''}${dp != null ? `<span>schema ${k1(best.plan)} kg (${dp > 0.04 ? '+' : dp < -0.04 ? '−' : ''}${k1(dp)})</span>` : ''}`;
  tip.hidden = false;
  const px = best.x / 340 * box.width, py = best.y / 210 * box.height;
  tip.style.left = clamp(px - tip.offsetWidth / 2, 0, box.width - tip.offsetWidth) + 'px';
  tip.style.top = Math.max(0, py - tip.offsetHeight - 14) + 'px';
}
function wHide(){
  document.querySelectorAll('[data-wtip]').forEach(t => t.hidden = true);
  document.querySelectorAll('[data-wcross],[data-wdot],[data-wtdot]').forEach(n => n.setAttribute('opacity', '0'));
}
/* Knabbel looks at your finger: his eyes follow where you touch (or the mouse), and come back after a moment. */
let lookRaf = 0, lookT = null, lookAt = null;
function petLook(x, y){
  lookAt = [x, y]; if (lookRaf) return;
  lookRaf = requestAnimationFrame(() => { lookRaf = 0;
    document.querySelectorAll('.pet.alive .follow').forEach(f => { const r = f.closest('.pet').getBoundingClientRect(); if (!r.width) return;
      const dx = clamp((lookAt[0] - (r.left + r.width / 2)) / r.width, -1, 1), dy = clamp((lookAt[1] - (r.top + r.height * .45)) / r.height, -1, 1);
      f.style.transform = `translate(${(dx * 3.5).toFixed(1)}px,${(dy * 2.5).toFixed(1)}px)`; });
    clearTimeout(lookT); lookT = setTimeout(() => document.querySelectorAll('.pet .follow').forEach(f => { f.style.transform = ''; }), 1600); });
}
document.addEventListener('pointerdown', e => { if (FL('alive') && !reduceMotion()) petLook(e.clientX, e.clientY); }, { passive: true });
document.addEventListener('pointermove', e => { if (FL('alive') && !reduceMotion() && (e.pointerType === 'mouse' || e.buttons)) petLook(e.clientX, e.clientY); }, { passive: true });
let wSwipe = null;
document.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('[data-wchart]')) { wScrub(e); wSwipe = { x: e.clientX, y: e.clientY }; } else wHide(); });
document.addEventListener('pointerup', e => {
  const s0 = wSwipe; wSwipe = null; if (!s0 || e.pointerType === 'mouse') return;
  const dx = e.clientX - s0.x, dy = e.clientY - s0.y;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && document.querySelector('.wnav')) { wHide(); if (dx > 0) wOff++; else wOff = Math.max(0, wOff - 1); render(); }
});
document.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || e.buttons) wScrub(e); });
document.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') wHide(); }, true);
const FAST_HOURS = [2, 4, 8, 12, 14, 16, 18, 20, 24];
const fmtHours = h => { const m = Math.round(h * 60); return m < 60 ? `${m} minuten` : `${Math.floor(m / 60)} uur${m % 60 ? ` en ${m % 60} min` : ''}`; };
const FAST_PLANS = [[8, 'Rustig begin'], [12, 'Beginner'], [14, 'Gevorderd'], [16, 'De bekende 16:8']];
let fastCustom = false;
const hm = d => d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
let fastFrom = 'now', fastTime = '';
function lastMealTime(){
  const since = Date.now() - 20 * 3.6e6;
  return [todayKey(), shiftKey(todayKey(), -1)].flatMap(k => day(k).entries.filter(e => keyOf(e.t) === k)).map(e => e.t).filter(t => t > since && t <= Date.now()).sort((a, b) => b - a)[0] || null;
}
function fastStartTs(){
  if (fastFrom === 'last') return lastMealTime() || Date.now();
  if (fastFrom === 'custom' && /^\d{2}:\d{2}$/.test(fastTime)) {
    const [h, m] = fastTime.split(':').map(Number), d = new Date(); d.setHours(h, m, 0, 0);
    if (d.getTime() > Date.now()) d.setDate(d.getDate() - 1);
    return d.getTime();
  }
  return Date.now();
}
function tickFast(){
  const el = document.querySelector('[data-fastring]'); if (!el || !S.meta.fast.start) return;
  const F = S.meta.fast, ms = Date.now() - F.start, frac = ms / (F.goal * 3.6e6), leftMs = Math.max(0, F.goal * 3.6e6 - ms);
  el.innerHTML = ringSVG(frac, frac >= 1 ? 'var(--leaf)' : 'var(--accent)', 120, 11) + `<div class="mid"><span class="num" style="font-family:var(--display);font-size:20px">${Math.floor(ms / 3.6e6)}:${pad(Math.floor(ms / 6e4) % 60)}</span><span class="note">gevast</span></div>`;
  const m = document.querySelector('[data-fastmsg]');
  if (m) m.textContent = frac >= 1 ? `Klaar! ${F.goal} uur gehaald` : `Nog ${Math.floor(leftMs / 3.6e6)} u ${pad(Math.floor(leftMs / 6e4) % 60)} m`;
}
let ciAll = false;
