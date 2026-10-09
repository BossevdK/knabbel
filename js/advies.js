/* The check-in sheet, advice and ideas. */
/* ---------- check-in sheet ---------- */
let C = null;
/* A weigh-in done (from its own sheet, or by entering today's weight while one is due): saved, judged against your
   schedule, rewarded, and the result shown. */
function completeCheckin(kg, week){
  const tk = todayKey();
  S.meta.weights = S.meta.weights.filter(w => w.date !== tk).concat({ date: tk, kg });
  const res = assess(kg, week);
  S.meta.checkins = S.meta.checkins.filter(c => c.week !== week).concat({ week: res.week, date: res.date, kg: res.kg, expected: res.expected, start: res.start, status: res.status, avg: res.avg, logged: res.logged });
  S.profile.weight = kg; retarget(); updateBurn();
  S.meta.checkinSnooze = null; S.meta.notifAt = 0;
  save(); C = { ...(C || {}), week, kg, result: res }; renderCheckin(); reward(10, 20, null, 'Weegmoment'); scheduleReminder();
  if (res.status === 'good') confetti();
  if (view !== 'today') render();
}
async function openCheckin(){
  L = null;
  const w = dueWeek() || Math.max(1, Math.floor(daysBetween(firstLogKey(), todayKey()) / 7));
  const last = [...S.meta.weights].sort((a, b) => a.date.localeCompare(b.date)).pop();
  C = { week: w, kg: last ? last.kg : S.profile.weight, hc: null, result: null };
  renderCheckin();
}
function renderCheckin(){
  if (!C) return;
  if (C.result) {
    const R = C.result;
    sheet(`Weegmoment week ${R.week}`, `
      <div class="card" style="align-items:center;text-align:center">
        <div class="pet" style="width:120px">${petSVG(R.status === 'bad' ? 'hungry' : 'happy', S.meta.pet.wear)}</div>
        <span class="pill ${R.status}">${esc(R.title)}</span>
      </div>
      <div class="grid3"><div class="stat card"><b class="num">${kgStr(R.kg)}</b><span class="note">nu (kg)</span></div>
        <div class="stat card"><b class="num">${kgStr(R.expected)}</b><span class="note">gepland (kg)</span></div>
        <div class="stat card"><b class="num">${R.kg - R.start > 0.04 ? '+' : R.kg - R.start < -0.04 ? '−' : ''}${kgStr(Math.abs(R.kg - R.start))}</b><span class="note">sinds start</span></div></div>
      <div class="card">${R.advice.map(a => `<p>${esc(a)}</p>`).join('')}
        ${R.logged ? `<p class="note num">Vorige week: ${R.logged} dagen gelogd, gemiddeld ${R.avg} kcal (doel ${R.budget}).</p>` : ''}</div>
      ${R.action && !R.applied ? `<button class="btn block ghost" data-act="ci-adjust">${esc(R.action.label)}</button>` : ''}
      ${R.applied ? `<div class="ok">Je nieuwe eetdoel is ${S.profile.targets.kcal} kcal.</div>` : ''}
      <button class="btn block" data-act="close">Klaar</button>`);
    return;
  }
  sheet(`Weegmoment week ${C.week}`, `
    <p class="muted">Weeg jezelf het liefst 's ochtends, na het plassen en voor het ontbijt. Dan kun je de weken goed vergelijken.</p>
    <label class="field">Je gewicht vandaag (kg)<input id="ci-kg" type="text" inputmode="decimal" autocomplete="off" value="${kgStr(C.kg)}"></label>
    <button class="btn block" data-act="ci-save">Bekijk of ik op schema lig</button>
    <button class="btn block ghost" data-act="ci-later">Morgen herinneren</button>`);
}

/* ---------- advice ---------- */
/* What you chose for ideas, in one line (shown on the closed "Wensen" row). */
const ideaOptsSummary = () => [[...A.prefs].join(', '), ({ auto: 'automatisch', snack: 'tussendoor', meal: 'maaltijd' })[S.meta.ideaFor || 'auto'], `${S.meta.ideaPersons || 1} ${(S.meta.ideaPersons || 1) === 1 ? 'persoon' : 'personen'}`].filter(Boolean).join(' · ');
document.addEventListener('toggle', e => { if (e.target.matches && e.target.matches('details.opts')) A.optsOpen = e.target.open; }, true);
const PREFS = ['Snel klaar', 'Zonder koken', 'Veel eiwit', 'Zoet', 'Hartig', 'Vegetarisch', 'Goedkoop'];
const A = { prefs: new Set(), busy: false, res: null, error: '', token: 0, extra: '' };
function adviceHTML(){
  if (A.res && A.res.day !== todayKey()) A.res = null;
  const T = S.profile.targets, k = todayKey(), t = totals(k), B = budget(k), left = B.kcal - t.kcal;
  const M = macroGoals(k), lp = M.p - t.p, lc = M.c - t.c, lf = M.fMax - t.f;
  return `
  <div class="top"><div class="row" style="gap:10px">${miniPetHTML()}<h1>Wat kan ik nog eten?</h1></div></div>
  <p class="leftline num"><b style="color:${left < 0 ? 'var(--warn-ink)' : 'var(--ink)'}">${r0(left)} kcal</b> over${B.bonus ? ` <span class="note">(incl. ${B.bonus} beweging)</span>` : ''}<br><span class="note">nog <span class="keep">${r0(Math.max(0, lp))} g eiwit</span> · <span class="keep">${r0(Math.max(0, lc))} g koolh.</span> · <span class="keep">${r0(Math.max(0, lf))} g vet</span></span></p>
  <section class="card">
    <h3>Kan dit?</h3>
    <div class="ask"><input id="fitText" autocomplete="off" enterkeyhint="send" placeholder="Bijv. een zak chips" aria-label="Waar heb je zin in?" value="${esc(FIT.text || '')}"><button class="btn small outline" data-act="fit-ask">Past het?</button></div>
  </section>
  <section class="card">
    <h3>Of laat je iets voorstellen</h3>
    <label class="field">Nog iets? (optioneel)<input id="advExtra" value="${esc(A.extra)}" placeholder="Bijv. ik heb nog kip en rijst in huis"></label>
    <details class="opts" ${A.optsOpen ? 'open' : ''}><summary><b>Wensen</b><span class="note">${ideaOptsSummary()}</span>${CHEV}</summary>
    <div class="row wrap">${PREFS.map(p => `<button class="chip" data-pref="${p}" aria-pressed="${A.prefs.has(p)}">${p}</button>`).join('')}</div>
    <div class="persons"><span class="eyebrow">Waarvoor?</span><div class="seg" role="group" aria-label="Waarvoor">${[['auto', 'Automatisch'], ['snack', 'Tussendoor'], ['meal', 'Maaltijd']].map(([v, l]) => `<button data-ideafor="${v}" aria-pressed="${(S.meta.ideaFor || 'auto') === v}">${l}</button>`).join('')}</div></div>
    <div class="persons"><span class="eyebrow">Voor hoeveel personen?</span><div class="seg" role="group" aria-label="Aantal personen">${[1, 2, 3, 4, 5, 6].map(n => `<button data-persons="${n}" aria-pressed="${(S.meta.ideaPersons || 1) === n}">${n}</button>`).join('')}</div></div>
    </details>
    <p class="note num">${ideaPlanLine(ideaPlan())}</p>
    <button class="btn block" data-act="advise" ${A.busy ? 'disabled' : ''}>${A.res ? 'Nieuwe ideeën' : 'Geef me 4 ideeën'}</button>
    <button class="btn block ghost" data-act="advise-fridge" ${A.busy ? 'disabled' : ''}>🧊 Met wat ik in huis heb (foto)</button>
    <p class="note">Maak een foto van je koelkast of voorraadkast: ${esc(S.meta.pet.name)} bedenkt iets met wat je al hebt.</p>
  </section>
  ${A.error ? `<div class="err">${esc(A.error)}${/sleutel/.test(A.error) ? ' <button class="add-line" data-act="goto-ai">Naar instellingen</button>' : ''}</div>` : ''}
  ${A.busy ? `<div class="thinking"><span class="dots"><i></i><i></i><i></i></span><span class="grow">${A.res && A.res.partial ? 'Er komen nog meer ideeën aan…' : `${esc(S.meta.pet.name)} kijkt in de voorraadkast…`}<br><span class="note" id="aiStatus">${A.res && A.res.partial ? 'Je kunt ze al bekijken.' : 'Meestal binnen 5 tot 15 seconden.'}</span></span><button class="btn small ghost" data-act="stop-adv">Stop</button></div>` : ''}
  ${A.res ? `<section class="card">${ideasHTML()}</section>` : ''}
  ${tipHTML()}`;
}
function ideasHTML(){
  const t = totals(todayKey());
  return `
    <div class="row between"><span class="note">Ideeën van ${hm(new Date(A.res.at))}${r0(t.kcal) !== A.res.kcal ? ' · je hebt intussen gegeten' : ''}</span><button class="add-line" data-act="advise" style="min-height:32px;padding:0" ${A.busy ? 'disabled' : ''}>Vernieuwen</button></div>
    ${A.res.summary ? `<p class="bubble">${esc(A.res.summary)}</p>` : ''}
    ${A.res.dropped ? `<p class="note">${A.res.dropped === 1 ? '1 idee paste niet en is weggelaten' : `${A.res.dropped} ideeën pasten niet en zijn weggelaten`}. Vraag nieuwe ideeën voor meer keus.</p>` : ''}
    <div>${A.res.ideas.map((x, i) => { const open = A.open === i, more = x.ingr.length || x.how, n = x.persons || 1;
      const euro = v => '€' + v.toFixed(2).replace('.', ',');
      return `<div class="idea">
      <div class="idea-h">
        <span class="row between" style="width:100%"><h3 class="grow">${esc(x.name)}</h3><span class="num" style="font-weight:700">${r0(x.kcal)} kcal</span></span>
        ${x.over || x.overC || x.overF ? `<span class="row wrap">${x.over ? `<span class="tag num over">± ${x.over} kcal te veel</span>` : ''}${x.overC ? '<span class="tag over">veel koolhydraten</span>' : ''}${x.overF ? '<span class="tag over">veel vet</span>' : ''}</span>` : ''}
        <span class="row wrap"><span class="tag">${esc(x.type)}</span>${x.effort ? `<span class="tag">${esc(x.effort)}</span>` : ''}${x.price ? `<span class="tag num price">🛒 ± ${euro(x.price)}${n > 1 ? ` · ${n} pers.` : ''}</span>` : ''}<span class="tag num">${macroLine(x)}${n > 1 ? ' p.p.' : ''}</span></span>
      </div>
      <p>${esc(x.why)}</p>
      ${more ? `<div class="idea-more${open ? '' : ' clip'}" id="idea-more-${i}">
        ${x.ingr.length ? `<div class="eyebrow">${A.res.fridge ? 'Wat je gebruikt' : 'Wat je koopt'}${n > 1 ? ` (voor ${n} personen)` : ''}${A.res.fridge ? '' : ' · geen restjes'}</div><div class="ingr" lang="nl">${x.ingr.map(g => `<div class="irow"><span><span>${esc(g.name)}</span><span class="note num">${g.pack ? esc(g.pack) : `${r0(g.grams)} ${itemMl({ name: g.name, unit: 'g', grams: g.grams }) ? 'ml' : 'g'}`}</span></span>${n === 1 ? `<b class="num">${r0(g.kcal)} kcal</b>` : ''}</div>`).join('')}</div>` : x.portion ? `<p class="note">${esc(x.portion)}</p>` : ''}
        ${x.how ? `<div class="eyebrow">Zo maak je het</div><p>${esc(x.how)}</p>` : ''}
      </div>
      <button class="idea-toggle" data-ideaopen="${i}" aria-expanded="${open}" aria-controls="idea-more-${i}" aria-label="${open ? 'Recept inklappen' : 'Heel recept tonen'}"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="transform:rotate(${open ? 180 : 0}deg)"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
        : x.portion ? `<p class="note">${esc(x.portion)}</p>` : ''}
      <button class="btn small ghost" data-addidea="${i}" style="align-self:flex-start">+ Ik eet dit${n > 1 ? ' (1 portie)' : ''}</button>
    </div>`; }).join('')}</div>`;
}
/* An ingredient of an idea with the official NEVO values for its weight, when NEVO has a product close to the AI's
   estimate (the same check as for photos); otherwise the AI's estimate stays. */
function nevoIngredient(g){
  if (!(g.grams > 0)) return g;
  const n = nevoMatch(g.name, g.kcal > 0 ? g.kcal / g.grams * 100 : null); if (!n || !(g.kcal > 0)) return g;
  const per = v => v * g.grams / 100;
  return { ...g, kcal: per(n.kcal), p: per(n.p), c: per(n.c), f: per(n.f), sf: n.sf == null ? g.sf : per(n.sf), nevo: n.code };
}
/* From the AI's answer (whole, or the ideas that have come in so far) to the ideas shown: numbers from the ingredients,
   checked against the room that is left. */
function buildIdeas(res, persons, plan, room){
  const ideas = (Array.isArray(res?.ideeen) ? res.ideeen : []).map(x => ({ name: String(x.naam || 'Idee').slice(0, 80), portion: String(x.portie || '').slice(0, 120), persons, price: num(x.prijs) || null,
    type: x.soort === 'maaltijd' ? 'Maaltijd' : 'Snack', effort: String(x.moeite || '').slice(0, 20), kcal: num(x.kcal), p: num(x.eiwit), c: num(x.koolhydraten), f: num(x.vet), sf: x.verzadigd != null ? num(x.verzadigd) : null, score: clamp(r0(x.score), 0, 10) || null, why: String(x.waarom || '').slice(0, 240),
    how: String(x.bereiding || '').slice(0, 200),
    ingr: (Array.isArray(x.ingredienten) ? x.ingredienten : []).slice(0, 6).map(g => ({ name: String(g.naam || '').slice(0, 60), pack: String(g.verpakking || '').slice(0, 40), grams: num(g.gram), kcal: num(g.kcal), p: num(g.eiwit), c: num(g.koolhydraten), f: num(g.vet), sf: g.verzadigd != null ? num(g.verzadigd) : null })).map(nevoIngredient).filter(g => g.name) }));
  // The numbers of an idea come from its ingredients: that is what you buy, cook and eat (the AI's own totals sometimes
  // describe a smaller portion than the ingredient list). Logging it then gives exactly what the idea showed.
  ideas.forEach(x => { if (!x.ingr.length || !x.ingr.every(g => g.grams > 0) || !x.ingr.some(g => g.kcal > 0)) return;
    const n = x.persons || 1, sum = f => x.ingr.reduce((a, g) => a + (g[f] || 0), 0) / n;
    x.kcal = sum('kcal'); x.p = sum('p'); x.c = sum('c'); x.f = sum('f'); x.sf = x.ingr.every(g => g.sf != null || g.f < 1) ? sum('sf') : x.sf;
    x.portion = ''; });
  for (let i = ideas.length - 1; i >= 0; i--) if (!(ideas[i].kcal > 0) || ideas[i].name === 'Idee') ideas.splice(i, 1);
  // The app checks the AI: more than 25% over the room goes, more than 10% over gets an orange label.
  const limit = Math.max(plan.room, 60);
  ideas.forEach(x => { x.over = x.kcal > limit * 1.10 ? Math.round((x.kcal - limit) / 10) * 10 : 0;
    x.overC = x.c > room.c * 1.2 + 10; x.overF = x.f > room.f * 1.2 + 5; });
  const fits = ideas.filter(x => x.kcal <= limit * 1.25), dropped = ideas.length - fits.length;
  return { ideas, fits, dropped, limit };
}
/* While the answer streams in: the ideas that are complete so far ({...} inside "ideeen":[ ), and the summary. */
function partialIdeas(txt){
  const out = [], a = txt.indexOf('"ideeen"'), b = a < 0 ? -1 : txt.indexOf('[', a);
  if (b < 0) return out;
  let depth = 0, start = -1, inStr = false, escp = false;
  for (let k = b + 1; k < txt.length; k++) {
    const ch = txt[k];
    if (inStr) { if (escp) escp = false; else if (ch === '\\') escp = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') { if (!depth) start = k; depth++; }
    else if (ch === '}') { depth--; if (!depth && start >= 0) { try { out.push(JSON.parse(txt.slice(start, k + 1))); } catch (e) {} start = -1; } }
    else if (ch === ']' && !depth) break;
  }
  return out;
}
const partialSummary = txt => { const m = txt.match(/"samenvatting"\s*:\s*"((?:[^"\\]|\\.)*)"/); try { return m ? JSON.parse('"' + m[1] + '"') : ''; } catch (e) { return ''; } };
async function adviseFridge(){
  let img; try { img = await pickImage('take'); } catch (e) { toast('De foto lukte niet. Probeer het nog eens.'); return; }
  if (img && img.data) advise(img);
}
async function advise(img){
  warmAI();
  A.extra = $('#advExtra')?.value || A.extra;
  const P = S.profile, T = P.targets, k = todayKey(), t = totals(k), B = budget(k), M = macroGoals(k);
  const eaten = day(k).entries.filter(e => !e.pending).map(e => `${e.name} (${r0(e.kcal)} kcal)`).join('; ') || 'nog niets';
  const prefs = String(S.meta.aiPrefs || '').trim();   // your own standards (Settings, AI), like "skyr = bak van 450 g"
  const now = new Date(), time = pad(now.getHours()) + ':' + pad(now.getMinutes());
  const mv = day(k).move;
  // Variety: what you were offered lately is left out, and every day gets a different theme.
  const recent = (S.meta.ideaHist || []).slice(-16), persons = clamp(S.meta.ideaPersons || 1, 1, 8), plan = ideaPlan();
  if (!img && plan.room < 60 && !plan.light) { A.res = null; A.error = plan.kind === 'snack' ? 'Er is nu geen ruimte voor een tussendoortje: die houdt Knabbel vrij voor je volgende maaltijd. Kies Automatisch of Maaltijd.' : 'Er is vandaag geen ruimte meer voor een maaltijd. Kies Automatisch voor iets heel lichts.'; render(); return; }
  // The share of what's left that this snack or meal may use, also for carbs, fat and saturated fat.
  const leftK = Math.max(1, B.kcal - t.kcal), share = clamp(plan.room / leftK, 0, 1);
  const room = { c: Math.max(0, M.c - t.c) * share, f: Math.max(0, M.fMax - t.f) * share, sf: Math.max(0, M.sfMax - t.sf) * share };
  const cheap = A.prefs.has('Goedkoop');
  const THEMES = ['Italiaans', 'Aziatisch', 'Mexicaans', 'Midden-Oosten', 'Hollandse pot', 'Grieks/mediterraan', 'Indiaas', 'vegetarisch', 'vis', 'iets met eieren', 'ovenschotel', 'salade/bowl', 'soep', 'iets op brood', 'Japans', 'Noord-Afrikaans'];
  const theme = THEMES[(dayNo() * 7 + (A.round = (A.round || 0) + 1) * 3) % THEMES.length];
  const prompt = `Je bent een vriendelijke voedingscoach in een Nederlandse calorie-app. Antwoord in het Nederlands.
Doel gebruiker: ${GOAL_NAME[P.goal] || 'afvallen'}.
Dagbudget: ${B.kcal} kcal${B.bonus ? ` (waarvan ${B.bonus} extra door beweging${mv ? `: ${mv.steps} stappen, ${mv.min} min training` : ''})` : ''}, eiwit ${M.p} g, vet tussen ${M.fMin} en ${M.fMax} g (verzadigd vet hooguit ${M.sfMax} g), koolhydraten de rest (nu ${M.c} g).
Vandaag al gegeten: ${eaten}. Totaal: ${r0(t.kcal)} kcal, eiwit ${r0(t.p)} g, koolhydraten ${r0(t.c)} g, vet ${r0(t.f)} g.
Nog over: ${r0(Math.max(0, B.kcal - t.kcal))} kcal, eiwit ${r0(Math.max(0, M.p - t.p))} g, koolhydraten ${r0(Math.max(0, M.c - t.c))} g, vet ${r0(Math.max(0, M.fMax - t.f))} g, verzadigd vet ${r0(Math.max(0, M.sfMax - t.sf))} g. Kies bij vet liefst onverzadigd (noten, olijfolie, vette vis).
Het is nu ${time}. Wensen: ${[...A.prefs].join(', ') || 'geen'}.${A.extra ? `
Extra wens van de gebruiker: "${A.extra.slice(0, 300)}". Dit is een harde eis voor ALLE 4 de ideeën: noemt de gebruiker een product of ingrediënt (bijv. skyr, of "kip en rijst"), dan zit dat in elk van de 4 ideeën; noemt hij of zij iets anders (zoals "warm" of "met de airfryer"), dan voldoet elk idee daaraan.` : ''}
Eet niet / liever niet: ${P.notes || 'geen beperkingen genoemd'}.
${prefs ? `Vaste standaarden van deze gebruiker (wat hij of zij koopt: soort, merk en verpakking). Gebruik ze voor de ingrediënten, de verpakking en de hoeveelheden:
${prefs.slice(0, 600)}
` : ''}Opdracht: geef 4 concrete, verschillende ideeën voor ${plan.kind === 'snack' ? 'een tussendoortje (soort: snack)' : `${plan.label} (soort: maaltijd)`}. Elk idee hooguit ${r0(plan.room)} kcal per persoon${plan.keep > 0 && plan.names.length ? `; de gebruiker houdt nog ± ${r0(plan.keep)} kcal vrij voor ${andList(plan.names)}, gebruik die ruimte dus niet` : ''}. Vul vooral een eiwittekort aan${plan.kind === 'snack' ? ' (bijv. kwark, skyr, een ei, edamame, hüttenkäse)' : ''}. Gebruik producten uit AH/Jumbo met realistische porties en NEVO-waarden. Het zijn alternatieven: elk idee past los binnen die ruimte. Is die ruimte kleiner dan 100 kcal, stel dan hooguit lichte opties voor (thee, bouillon, komkommer) en zeg vriendelijk dat het zo mooi is.
${A.extra ? 'Afwisseling: houd je aan de extra wens, en maak de 4 ideeën verschillend in bereiding, smaak en wat erbij komt.' : `Afwisseling: maak de 4 ideeën echt verschillend (andere keukens, ander hoofdingrediënt). Thema voor vandaag om je op weg te helpen: ${theme}.`}${recent.length ? ` Stel deze niet opnieuw voor (die kreeg de gebruiker al): ${recent.join('; ')}.` : ''}
Per idee per persoon ook hooguit ± ${r0(room.c)} g koolhydraten en ± ${r0(room.f)} g vet (waarvan hooguit ${r0(room.sf)} g verzadigd), zodat het in de rest van de dag past.
${cheap ? `Goedkoop is echt belangrijk: hooguit ± €2,50 per persoon. Gebruik huismerk (AH Basic, Jumbo), eieren, peulvruchten, kipdij of gehakt, seizoensgroente, rijst, pasta, aardappels, havermout, kwark. Geen dure dingen zoals zalm, garnalen, noten, avocado of kant-en-klaar.
` : ''}Personen: het recept is voor ${persons} ${persons === 1 ? 'persoon' : 'personen'}. De ingrediënten (gram, kcal en macro's) en de prijs gelden voor het hele recept; de app deelt zelf door het aantal personen, dus voor ${persons} ${persons === 1 ? 'persoon' : 'personen'}.
${img ? `Er is een foto van de koelkast of voorraadkast van de gebruiker bijgevoegd. Bedenk ideeën met vooral wat op de foto te zien is (plus basisdingen uit de voorraad). Zoek liefst ideeën waarvoor niets gekocht hoeft te worden; is er toch iets nodig, hooguit 1 ingrediënt. verpakking: "uit je koelkast" voor wat op de foto staat. prijs: alleen wat er nog gekocht moet worden, anders 0.
` : ''}${img ? 'Hoeveelheden: zoveel als je redelijk uit de koelkast gebruikt.' : 'Geen restjes:'}${img ? '' : ` stem de hoeveelheden af op gangbare verpakkingen bij AH of Jumbo, zodat de gebruiker precies koopt wat het recept gebruikt en niets overhoudt. Gebruik dus hele verpakkingen of losse stuks (bv. 1 bakje kipfilet van 300 g, 1 zak spinazie van 200 g, 2 eieren, 1 paprika). Is een verpakking te groot voor ${persons === 1 ? '1 persoon' : `${persons} personen`} binnen de kcal, kies dan een ander product of een kleinere verpakking. Basisdingen die bijna iedereen in huis heeft (zout, peper, olie, kruiden, bouillonblokje) mogen gewoon.`}
verpakking: per ingrediënt wat je koopt, kort (bv. "1 bakje (300 g)", "2 stuks", "uit de voorraad").
gram is wat er echt in het gerecht gaat en opgegeten wordt (dus de hele verpakking, niets over). Geef kcal en macro's alleen per ingrediënt: de app telt ze zelf op. "portie" beschrijft dezelfde hoeveelheden.
prijs: wat je ongeveer afrekent bij AH of Jumbo voor alles wat je moet kopen (zonder de basisdingen uit de voorraad), in euro.
"verzadigd" is hoeveel gram van het vet verzadigd vet is. score: voedingskwaliteit van 1 (ongezond) tot 10 (heel voedzaam, veel eiwit/vezels/groente).
Houd het kort: hooguit 5 ingrediënten per idee, "waarom" hooguit 12 woorden, "bereiding" hooguit 20 woorden.
Antwoord met alleen JSON:
{"samenvatting":"1-2 korte zinnen","ideeen":[{"naam":"Magere kwark met blauwe bessen","portie":"250 g kwark + 75 g bessen","soort":"snack|maaltijd","moeite":"geen koken|5 min|15 min|30 min","score":9,"prijs":2.5,"waarom":"waarom dit nu past","ingredienten":[{"naam":"Magere kwark","gram":250,"verpakking":"1 bakje (250 g)","kcal":140,"eiwit":22,"koolhydraten":10,"vet":0.5,"verzadigd":0.3},{"naam":"Blauwe bessen","gram":125,"verpakking":"1 bakje (125 g)","kcal":72,"eiwit":1,"koolhydraten":8,"vet":0.2,"verzadigd":0}],"bereiding":"korte bereiding"}]}`;
  A.busy = true; A.error = ''; const tok = ++A.token; if (ASK) renderAsk(); else render();
  try {
    // The ideas show one by one while Google writes them, instead of all at once after 10 to 20 seconds.
    let shown = 0;
    const onPartial = txt => {
      if (tok !== A.token) return;
      const list = partialIdeas(txt); if (list.length <= shown) return; shown = list.length;
      const P2 = buildIdeas({ ideeen: list }, persons, plan, room);
      if (!P2.fits.length) return;
      A.res = { summary: partialSummary(txt).slice(0, 300), ideas: P2.fits, dropped: 0, room: P2.limit, at: Date.now(), day: k, kcal: r0(t.kcal), meal: plan.meal, fridge: !!img, partial: true };
      if (ASK) renderAsk(); else if (view === 'advice') render();
    };
    const res = await aiJSON(prompt, 60000, IDEAS_SCHEMA, 0.9, img || null, false, img ? 'koelkast' : 'ideeen', onPartial);
    if (tok !== A.token) return;
    A.open = null;
    const { ideas, fits, dropped, limit } = buildIdeas(res, persons, plan, room);
    if (!ideas.length) A.error = 'Er kwamen geen ideeën terug. Probeer het nog eens.';
    else if (!fits.length) A.error = `Geen van de ideeën paste in je ruimte van ± ${r0(limit / 10) * 10} kcal. Vraag nieuwe ideeën.`;
    else { A.res = { summary: String(res.samenvatting || '').slice(0, 300), ideas: fits, dropped, room: limit, at: Date.now(), day: k, kcal: r0(t.kcal), meal: plan.meal, fridge: !!img };
      S.meta.ideaHist = [...(S.meta.ideaHist || []), ...ideas.map(x => x.name)].slice(-24); S.meta.ideaRolls = (S.meta.ideaRolls || 0) + 1; save(); }
  } catch (e) {
    if (tok !== A.token) return;
    // Some ideas already came in before it went wrong: those stay.
    if (A.res && A.res.partial) { A.res.partial = false; A.error = 'Niet alle ideeën kwamen door. Vraag nieuwe ideeën voor meer keus.'; }
    else A.error = errCopy(e);
  }
  A.busy = false;
  if (ASK) renderAsk(); else if (view === 'advice') render();
}

/* ---------- ideas: for a snack or for a meal ---------- */
const MEAL_NAME = m => (MEALS.find(x => x[0] === m) || [0, m])[1].toLowerCase();
function ideaPlan(){
  const k = todayKey(), left = Math.max(0, budget(k).kcal - totals(k).kcal), cur = defaultMeal(), h = new Date().getHours() + new Date().getMinutes() / 60;
  const main = ['ontbijt', 'lunch', 'diner'];
  const upcoming = main.filter(m => (m === cur || MEAL_START[m] > h) && !mealDone(k, m));
  const why = cur !== 'snack' && mealDone(k, cur) ? `je ${MEAL_NAME(cur)} is al gelogd` : '';
  let kind = S.meta.ideaFor || 'auto';
  if (kind === 'auto') kind = cur !== 'snack' && !mealDone(k, cur) ? 'meal' : 'snack';
  const keepFor = list => { const xs = list.map(m => ({ m, kcal: usualMealKcal(m) ?? Math.round(budget(k).base * MEAL_SHARE[m] / 10) * 10 })); return { kcal: xs.reduce((a, x) => a + x.kcal, 0), names: xs.map(x => MEAL_NAME(x.m)) }; };
  if (kind === 'meal') {
    const meal = upcoming[0] || null, keep = keepFor(upcoming.slice(1)), room = Math.max(0, left - Math.min(keep.kcal, left));
    return { kind, meal, room, keep: Math.min(keep.kcal, left), names: keep.names, why: S.meta.ideaFor === 'meal' ? '' : why,
      label: meal ? MEAL_NAME(meal) : 'een extra maaltijd' };
  }
  const keep = keepFor(upcoming), free = Math.max(0, left - Math.min(keep.kcal, left));
  // Automatic and hardly room for a snack: ideas for the next meal instead. No meal left either: very light ideas (up to 100 kcal).
  if ((S.meta.ideaFor || 'auto') === 'auto' && free < 100) {
    if (upcoming.length) { const rest = keepFor(upcoming.slice(1)), room = Math.max(0, left - Math.min(rest.kcal, left));
      return { kind: 'meal', meal: upcoming[0], room, keep: Math.min(rest.kcal, left), names: rest.names, why: 'te weinig ruimte voor een tussendoortje', label: MEAL_NAME(upcoming[0]) }; }
    return { kind, meal: 'snack', room: 100, light: true, keep: 0, names: [], why: free > 0 ? 'je zit bijna aan je doel' : 'je doel is bereikt', label: 'iets heel lichts' };
  }
  return { kind, meal: 'snack', room: Math.min(300, free), keep: Math.min(keep.kcal, left), names: keep.names, why, label: 'een tussendoortje' };
}
function ideaPlanLine(P){
  const keep = P.keep > 0 && P.names.length ? ` Je houdt ± ${r0(P.keep / 10) * 10} kcal over voor je ${andList(P.names)}.` : '';
  if (P.light) return `Iets heel lichts (${P.why}): hooguit 100 kcal, zoals thee, bouillon of wat rauwkost.`;
  return `${P.kind === 'snack' ? 'Voor een tussendoortje' : `Voor je ${P.label}`}${P.why ? ` (${P.why})` : ''}: ± ${r0(P.room / 10) * 10} kcal.${keep}`;
}

