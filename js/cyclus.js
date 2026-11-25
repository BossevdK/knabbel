/* The day of your cycle (optional, off by default), so a rise in weight can be put in perspective: in the days before and
   at the start of a period the body often holds 0.5 to 2 kg of extra water. You give the first day of each period; Knabbel
   counts the days from there. Everything stays on this device: it isn't in a report, a back-up of the AI questions or
   anywhere else. These are common patterns, not medical advice, so the wording stays careful ("often"). */
const cycleCfg = () => S.meta.cycle;
const cycleOn = () => !!(S.meta.cycle && S.meta.cycle.on);
/* Day 1 is the first day of the period. After the usual length it keeps counting for 10 more days (a period can be late);
   after that the last period is too long ago to say anything. */
function cycleDay(k){
  const C = S.meta.cycle; if (!C || !C.on) return null;
  const s = (C.starts || []).filter(x => x <= k).sort().pop(); if (!s) return null;
  const n = daysBetween(s, k) + 1;
  return n <= (C.len || 28) + 10 ? n : null;
}
/* The days with likely extra water: the last week before the next one and the first two days of it. When the next one is
   already filled in, those days are known exactly (also for an irregular cycle); only for the latest cycle they are expected
   from the usual length. */
function cycleWater(k){
  const C = S.meta.cycle; if (!C || !C.on) return false;
  const st = (C.starts || []).slice().sort(), next = st.find(x => x > k), cur = st.filter(x => x <= k).pop();
  if (cur && daysBetween(cur, k) + 1 <= 2) return true;
  if (next) return daysBetween(k, next) <= 7;
  const n = cycleDay(k); if (n == null) return false;
  return n >= (C.len || 28) - 6;
}
/* What your own weights say: for every finished cycle the average of the last 7 days before the next one against the
   average of days 8 to 14 of that cycle. Needs two cycles with weigh-ins in both parts. */
function cyclePattern(){
  const C = S.meta.cycle; if (!C || !C.on || (C.starts || []).length < 3) return null;
  const st = C.starts.slice().sort(), W = S.meta.weights, avg = (a, b) => { const v = W.filter(x => x.date >= a && x.date <= b).map(x => x.kg); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null; };
  const diffs = [];
  for (let i = 0; i + 1 < st.length; i++) {
    const hi = avg(shiftKey(st[i + 1], -7), shiftKey(st[i + 1], -1)), lo = avg(shiftKey(st[i], 7), shiftKey(st[i], 13));
    if (hi != null && lo != null) diffs.push(hi - lo);
  }
  return diffs.length >= 2 ? { n: diffs.length, kg: diffs.reduce((a, d) => a + d, 0) / diffs.length } : null;
}
const kgPlus = v => `${v > 0.04 ? '+' : v < -0.04 ? '−' : ''}${String(r1(Math.abs(v))).replace('.', ',')} kg`;
function cyclePatternText(){
  const P = cyclePattern(); if (!P) return '';
  return P.kg >= 0.2 ? `Bij jou ging je gewicht de laatste ${P.n} keer in deze dagen gemiddeld ${kgPlus(P.kg)} omhoog.` : 'Bij jou is er de laatste keren in deze dagen weinig verschil in je gewicht.';
}
function cycleSet(on){
  const C = S.meta.cycle || (S.meta.cycle = { on: false, starts: [], len: 28 });
  C.on = on; save();
}
function cycleAddStart(k){
  const C = S.meta.cycle || (S.meta.cycle = { on: true, starts: [], len: 28 });
  if (!k || k > todayKey()) return false;
  if (!C.starts.includes(k)) C.starts.push(k);
  C.starts.sort(); C.starts = C.starts.slice(-12);
  // The length follows what you log: the average of the last gaps, when they are plausible (21 to 40 days).
  const gaps = C.starts.slice(1).map((s, i) => daysBetween(C.starts[i], s)).filter(g => g >= 21 && g <= 40).slice(-4);
  if (gaps.length >= 2) C.len = Math.round(gaps.reduce((a, g) => a + g, 0) / gaps.length);
  save(); return true;
}
/* On Voortgang, with the weight: which day it is, and what that means for the scale. */
function cycleNoteHTML(){
  if (!cycleOn()) return '';
  const n = cycleDay(todayKey()), w = cycleWater(todayKey());
  const btn = `<button class="add-line" data-act="cycle-start-today">Ik ben vandaag ongesteld geworden</button>`;
  if (n == null) return `<div class="cyclenote"><p class="note" style="margin:0">Cyclus: je hebt nog niet ingevuld wanneer je ongesteld was. ${btn}</p></div>`;
  return `<div class="cyclenote${w ? ' water' : ''}"><p style="margin:0"><b>Dag ${n} van je cyclus.</b> ${w
      ? `${cyclePattern() ? '' : 'Rond deze dagen houdt je lichaam vaak 0,5 tot 2 kg extra vocht vast. '}${cyclePatternText()} Een stijging op de weegschaal zegt nu weinig: kijk naar je trend.`
      : 'Rond deze dagen is er meestal geen extra vocht, dus je gewicht zegt nu het meest.'}</p>
    <p class="note" style="margin:4px 0 0">${btn}</p></div>`;
}
/* The grey-pink bands behind the days with likely extra water in the weight chart. */
function cycleBands(k0, kEnd, X, t, H, b){
  if (!cycleOn()) return '';
  const end = kEnd < todayKey() ? kEnd : todayKey(), half = Math.abs(X(shiftKey(k0, 1)) - X(k0)) / 2;
  let out = '';
  for (let k = k0; k <= end; k = shiftKey(k, 1)) if (cycleWater(k))
    out += `<rect x="${(X(k) - half).toFixed(1)}" y="${t}" width="${(half * 2).toFixed(1)}" height="${H - t - b}" fill="var(--cyc, #d96a8e)" opacity=".13"/>`;
  return out;
}
function cycleTip(k){
  const n = cycleDay(k); if (n == null) return '';
  return `<span>cyclusdag ${n}${cycleWater(k) ? ' · vaak extra vocht' : ''}</span>`;
}
/* In Instellingen. */
function cycleSettingsHTML(){
  const on = cycleOn(), C = S.meta.cycle || { starts: [], len: 28 }, n = cycleDay(todayKey());
  return `<section class="card" id="cyclus">
    <div class="row between"><h3>Cyclus bijhouden</h3><span class="pill ${on ? 'good' : 'warn'}">${on ? 'Aan' : 'Uit'}</span></div>
    <p class="muted">Rond je ongesteldheid houd je vaak 0,5 tot 2 kg extra vocht vast. Vul in wanneer je ongesteld wordt: dan laat Knabbel in de gewichtsgrafiek zien welke dagen dat zijn, en zegt bij een stijging dat het waarschijnlijk vocht is. Dit blijft alleen op ${thisDevice()}.</p>
    <div class="seg" role="group" aria-label="Cyclus bijhouden"><button data-cycon="1" aria-pressed="${on}">Aan</button><button data-cycon="0" aria-pressed="${!on}">Uit</button></div>
    ${on ? `<label class="field">Eerste dag van je laatste ongesteldheid<input type="date" id="cy-date" value="${todayKey()}" max="${todayKey()}"></label>
      <div class="row wrap"><button class="btn small" data-act="cycle-start">Opslaan</button></div>
      <label class="field">Of: op welke dag van je cyclus zit je nu?<input type="number" id="cy-today" inputmode="numeric" min="1" max="60" placeholder="bijv. 12"></label>
      <div class="row wrap"><button class="btn small ghost" data-act="cycle-day">Dit is vandaag</button></div>
      ${n != null ? `<p class="note">Vandaag is dag ${n} van je cyclus.</p>` : ''}
      ${(C.starts || []).length ? `<span class="eyebrow">Ingevulde keren</span>${[...C.starts].reverse().slice(0, 6).map(s => `<div class="eq"><span>${esc(longDate(s))}</span><button class="icon-btn" data-act="cycle-del" data-cdate="${s}" aria-label="Verwijder ${esc(longDate(s))}" style="background:var(--surface2)">×</button></div>`).join('')}` : ''}
      <label class="field">Lengte van je cyclus (dagen)<input type="number" id="cy-len" inputmode="numeric" min="21" max="40" value="${C.len || 28}"></label>
      ${cyclePatternText() ? `<p class="note"><b>${cyclePatternText()}</b></p>` : '<p class="note">Vul een paar keer in wanneer je ongesteld werd (liefst 3 keer): dan zie je hier hoe je eigen gewicht in die dagen schommelt.</p>'}
      <p class="note">Is je cyclus onregelmatig? Vul gewoon elke keer in wanneer je ongesteld wordt. De dagen vóór een ingevulde ongesteldheid zijn dan precies bekend, en alleen voor de komende keer schat Knabbel het. Dit zijn gewone patronen en geen medisch advies.</p>` : ''}
  </section>`;
}
