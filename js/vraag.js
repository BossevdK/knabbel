/* "Vraag het Knabbel": questions about fat loss, muscle and progress. */
/* ---------- "Vraag het Knabbel": questions about fat loss, muscle and your progress ----------
   The AI gets your own numbers (goal, weight and trend, pace, measured burn, what you ate last week), so it can answer
   about you and not in general. Kept only while the app is open: the last few questions and answers, for follow-ups. */
let QA = { text: '', busy: false, error: '', list: [], token: 0 };
const QA_EXAMPLES = ['Val ik vet af of vooral vocht?', 'Waarom sta ik stil op de weegschaal?', 'Hoe houd ik mijn spieren tijdens het afvallen?', 'Hoeveel vet ben ik al kwijt?'];
function qaContext(){
  const P = S.profile, T = P.targets, ws = weightSeries(), last = ws[ws.length - 1], tr = trendNow(), sl = weightSlope(), real = measureBurn();
  const keys = Array.from({ length: 7 }, (_, i) => shiftKey(todayKey(), -i - 1)).filter(fullDay);
  const avg = f => keys.length ? r0(keys.reduce((a, k) => a + totals(k)[f], 0) / keys.length) : null;
  const start = firstLogKey() ? startWeight() : null, weeks = firstLogKey() ? r1(daysBetween(firstLogKey(), todayKey()) / 7) : 0;
  const moved = moveOn() && keys.length ? r0(keys.reduce((a, k) => a + moveInfo(k).kcal, 0) / keys.length) : null;
  const extra = moved != null ? r0(keys.reduce((a, k) => a + moveInfo(k).extra, 0) / keys.length) : 0;
  // The last 2 weeks in numbers, so "why don't I lose weight?" can be answered with what really happened.
  const t14 = Array.from({ length: 14 }, (_, i) => shiftKey(todayKey(), -i - 1)), full14 = t14.filter(fullDay), dow = k => (dateOf(k).getDay() + 6) % 7;
  const eat = k => totals(k).kcal, bud = k => budget(k).kcal, mean = a => a.length ? r0(a.reduce((x, y) => x + y, 0) / a.length) : null;
  const over14 = full14.filter(k => eat(k) > bud(k) * 1.1), under14 = full14.filter(k => eat(k) < bud(k) * 0.8);
  const weekend = mean(full14.filter(k => dow(k) >= 5).map(eat)), weekday = mean(full14.filter(k => dow(k) < 5).map(eat));
  const burn = real ? real.tdee : T.tdee;
  const deficit14 = full14.length ? r0(full14.reduce((a, k) => a + (burn + (moveOn() ? moveInfo(k).extra : 0) - eat(k)), 0)) : null;
  const ts = useTrend() ? trendSeries() : [], tNow = ts.length ? ts[ts.length - 1].kg : null, t14ago = (ts.find(p => p.date === shiftKey(todayKey(), -14)) || {}).kg;
  const recent = ws.filter(w => daysBetween(w.date, todayKey()) <= 21).slice(-9).map(w => `${shortDate(w.date)} ${kgStr(w.kg)}`).join(', ');
  const steps = moveOn() && full14.length ? mean(full14.map(k => (day(k).move || {}).steps || 0).filter(x => x > 0)) : null;
  const detail = [
    recent ? `Wegingen van de laatste 3 weken: ${recent}.` : '',
    tNow != null && t14ago != null ? `Trendgewicht: nu ${kgStr(tNow)} kg, 2 weken geleden ${kgStr(t14ago)} kg (${r1(tNow - t14ago) > 0 ? '+' : ''}${String(r1(tNow - t14ago)).replace('.', ',')} kg).` : '',
    `Gelogd: ${full14.length} van de laatste 14 dagen volledig${full14.length < 14 ? ` (${14 - full14.length} dagen niet of niet helemaal: wat daar gegeten is, ontbreekt hieronder)` : ''}.`,
    full14.length ? `Over die ${full14.length} dagen: gemiddeld ${mean(full14.map(eat))} kcal bij een gemiddeld doel van ${mean(full14.map(bud))}; ${over14.length} dagen meer dan 10% boven het doel${over14.length ? ` (tot ${r0(Math.max(...over14.map(eat)))} kcal)` : ''}, ${under14.length} dagen onder 80% van het doel.` : '',
    weekend != null && weekday != null ? `Doordeweeks gemiddeld ${weekday} kcal, in het weekend ${weekend} kcal.` : '',
    deficit14 != null ? `Tekort volgens het logboek over die dagen: ${deficit14} kcal in totaal (≈ ${String(r1(deficit14 / 7700)).replace('.', ',')} kg vet), als alles is gelogd en het verbruik klopt.` : '',
    steps != null ? `Gemiddeld ${steps} stappen per dag.` : '',
    weeks < 2 ? 'De eerste 1 à 2 weken is veel van het gewichtsverlies vocht (water uit de glycogeenvoorraad), geen vet.' : ''
  ].filter(Boolean).join('\n');
  return [
    `Doel: ${GOAL_NAME[P.goal] || 'afvallen'}${P.goal === 'lose' ? `, tempo ${rateStr(P.rate)} kg per week` : ''}${P.goalWeight && P.goal !== 'maintain' ? `, streefgewicht ${kgStr(P.goalWeight)} kg` : ''}.`,
    `${P.sex === 'm' ? 'Man' : 'Vrouw'}, ${P.age} jaar, ${P.height} cm.`,
    last ? `Laatste weging ${kgStr(last.kg)} kg (${shortDate(last.date)})${tr != null ? `, trendgewicht ${kgStr(tr)} kg` : ''}${start != null ? `, start ${kgStr(start)} kg, ${weeks} weken geleden begonnen` : ''}.` : 'Nog geen wegingen.',
    sl != null ? `Tempo volgens de wegingen van de laatste 4 weken: ${sl * 7 > 0 ? '+' : ''}${rateStr(r1(sl * 7))} kg per week.` : 'Nog te weinig wegingen voor een tempo.',
    `Eetdoel ${T.kcal} kcal (minimum ${T.floor}), verbruik ${real ? `gemeten ${real.tdee}` : `geschat ${T.tdee}`} kcal per dag, eiwitdoel ${T.p} g.`,
    keys.length ? `Vorige week ${keys.length} van 7 dagen volledig gelogd: gemiddeld ${avg('kcal')} kcal, ${avg('p')} g eiwit, ${avg('c')} g koolhydraten, ${avg('f')} g vet.` : 'Vorige week geen volledig gelogde dagen.',
    moved != null ? `Gemiddeld ${moved} kcal per dag actief verbrand door beweging, waarvan ${extra} kcal meer dan op een gewone dag (een deel daarvan mag de gebruiker extra eten).` : '',
    detail
  ].filter(Boolean).join('\n');
}
async function askQA(text){
  text = String(text || (($('#qaText') || {}).value) || QA.text || '').trim();
  if (!text) { toast('Typ eerst je vraag.'); return; }
  if (QA.busy) return;
  const prev = QA.list.slice(-3);
  QA = { ...QA, text: '', busy: true, error: '', token: QA.token + 1, list: [...QA.list, { q: text.slice(0, 300), a: '' }] };
  const tok = QA.token;
  render();
  const prompt = `Je bent ${S.meta.pet.name}, een vriendelijke rode panda in een Nederlandse calorie-app. Je beantwoordt vragen over vetverlies, afvallen, spieren behouden of opbouwen, de weegschaal en eten. Antwoord in het Nederlands, vriendelijk en eerlijk, zonder schuldgevoel.
Gebruik de gegevens van de gebruiker hieronder en noem waar het helpt hun eigen getallen. Reken met 7700 kcal per kg lichaamsvet. Schommelingen van 1 à 2 kg per dag zijn meestal vocht, zout, koolhydraten en darminhoud, geen vet. Kun je iets uit de gegevens niet zeker zeggen, zeg dat dan.
Grenzen: geef nooit advies om onder het minimum van ${S.profile.targets.floor} kcal te eten of sneller dan 1% van het lichaamsgewicht per week af te vallen. Geen medische diagnoses; bij klachten, medicijnen, zwangerschap of een eetstoornis verwijs je vriendelijk naar de huisarts of een diëtist. Gaat de vraag niet over eten, gewicht, beweging of gezondheid, zeg dan kort dat je daar niet bij kunt helpen.
Een vraag als "waarom val ik niet af?" of "waarom sta ik stil?" beantwoord je als een onderzoeker, met de getallen hieronder en in deze volgorde: (1) Is het echt stilstaan? Kijk naar het trendgewicht over 2 weken en het tempo, niet naar één weging: daalt de trend, zeg dan dat het wél werkt, ook al zegt de weegschaal van gisteren iets anders. (2) Wat zegt het logboek? Hoeveel dagen zijn gelogd, wat is het tekort, zitten er dagen ver boven het doel of een weekend dat het tekort opeet. Wat niet gelogd is, ontbreekt en laat het tekort groter lijken dan het is. (3) Klopt het tekort met de weegschaal? Zo niet: ontbrekende logs, vocht of een lager verbruik dan gedacht. (4) Kies de ene oorzaak die uit déze gegevens het meest waarschijnlijk is en geef daar één concrete stap bij ("log ook de snacks van het weekend", "neem 2 weken de tijd", "eet 100 kcal minder op de dagen dat je boven je doel zit"). Geen algemene tips die voor iedereen gelden. Zeg eerlijk als het eigenlijk goed gaat of als je het niet zeker weet.
Houd het kort: 4 tot 7 zinnen, of een paar korte punten (begin een punt met "• " op een nieuwe regel). Geen kopjes, geen markdown.
Gegevens van de gebruiker:
${qaContext()}
${prev.length ? `Eerder in dit gesprek:\n${prev.map(x => `Vraag: ${x.q}\nAntwoord: ${x.a}`).join('\n')}\n` : ''}Vraag: """${text.slice(0, 300)}"""
Antwoord met alleen JSON: {"antwoord":"je antwoord"}`;
  try {
    // The answer appears word by word while Knabbel writes it (instead of all at once).
    const onPartial = txt => {
      if (tok !== QA.token) return;
      const a = partialString(txt, 'antwoord').replace(/\*\*/g, '');
      if (a && a !== QA.list[QA.list.length - 1].a) { QA.list[QA.list.length - 1].a = a; renderQA(); }
    };
    const j = await aiJSON(prompt, 45000, { type: 'OBJECT', properties: { antwoord: { type: 'STRING' } }, required: ['antwoord'] }, 0.3, null, false, 'vraag', onPartial);
    if (tok !== QA.token) return;
    const a = String((j && j.antwoord) || '').replace(/\*\*/g, '').trim().slice(0, 1500);
    if (!a) throw { code: 'empty' };
    QA.list[QA.list.length - 1].a = a;
  } catch (e) {
    if (tok !== QA.token) return;
    // Part of the answer had already come in: keep it, and say it stopped.
    if (QA.list[QA.list.length - 1].a) QA.error = 'Het antwoord kwam niet helemaal door. Vraag het gerust nog een keer.';
    else { QA.list.pop(); QA.text = text; QA.error = errCopy(e); }
  }
  QA.list = QA.list.slice(-6); QA.busy = false;
  if (view === 'progress') render();
}
/* The text of one field ("key":"...") while the JSON is still coming in, also when the closing quote isn't there yet. */
function partialString(txt, key){
  const m = txt.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`)); if (!m) return '';
  let v = m[1].replace(/\\u[0-9a-fA-F]{0,3}$|\\$/, '');   // a half escape at the very end waits for the next piece
  try { return JSON.parse(`"${v}"`); } catch (e) { return v.replace(/\\n/g, '\n').replace(/\\"/g, '"'); }
}
/* Only the question card is redrawn while the answer streams in (not the whole page with its charts). */
function renderQA(){
  if (view !== 'progress') return;
  const el = document.querySelector('.card.qa'); if (el) el.outerHTML = qaHTML(); else render();
}
function qaHTML(){
  const name = esc(S.meta.pet.name);
  const lines = a => a.split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => `<p>${esc(l)}</p>`).join('');
  return `<section class="card qa" aria-label="Vraag het ${name}">
    <div class="row between"><h3>💬 Vraag het ${name}</h3>${QA.list.length && !QA.busy ? '<button class="add-line" data-act="qa-clear" style="min-height:32px;padding:0">Wissen</button>' : ''}</div>
    ${QA.list.length ? '' : `<p class="note">Over vetverlies, de weegschaal of je spieren. ${name} kijkt mee naar jouw gewicht, tempo en wat je at.</p>
    <div class="row wrap">${QA_EXAMPLES.map(x => `<button class="chip" data-qa="${esc(x)}">${esc(x)}</button>`).join('')}</div>`}
    ${QA.list.map(x => `<p class="qa-q">${esc(x.q)}</p>${x.a ? `<div class="qa-a bubble">${lines(x.a)}</div>` : ''}`).join('')}
    ${QA.busy && !(QA.list.length && QA.list[QA.list.length - 1].a) ? `<div class="thinking"><span class="dots"><i></i><i></i><i></i></span><span class="grow">${name} denkt na…<br><span class="note" id="aiStatus">Een paar seconden.</span></span><button class="btn small ghost" data-act="qa-stop">Stop</button></div>` : ''}
    ${QA.error ? `<div class="err">${esc(QA.error)}${/sleutel/.test(QA.error) ? ' <button class="add-line" data-act="goto-ai">Naar instellingen</button>' : ''}</div>` : ''}
    <div class="ask"><input id="qaText" autocomplete="off" enterkeyhint="send" placeholder="${QA.list.length ? 'Nog een vraag?' : 'Stel je vraag'}" aria-label="Je vraag aan ${name}" value="${esc(QA.text || '')}" ${QA.busy ? 'disabled' : ''}><button class="btn small outline" data-act="qa-ask" ${QA.busy ? 'disabled' : ''}>Vraag</button></div>
    <p class="note">Advies op basis van je eigen cijfers, geen medisch advies.</p>
  </section>`;
}
function progressHTML(){
  return `
  <div class="top"><div class="row" style="gap:10px">${miniPetHTML()}<h1>Voortgang</h1></div><button class="btn small ghost" data-nav="profile">Jij &amp; je doel ›</button></div>
  ${weightCardHTML()}
  ${logCheckHTML()}
  ${girthHTML()}
  ${weekBudgetHTML()}
  ${qaHTML()}


  ${Object.keys(S.days).filter(k => (S.days[k].entries || []).length).length < 3 ? (() => { const n = Object.keys(S.days).filter(k => (S.days[k].entries || []).length).length;
    return `<section class="card" aria-label="Statistieken"><div class="unlock"><h3>Je statistieken</h3>
      <div class="slots" role="img" aria-label="${n} van 3 dagen gelogd">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}">${i < n ? '✓' : i + 1}</i>`).join('')}</div>
      <p class="muted">${n === 0 ? 'Log 3 dagen, dan zie je hier je week: gemiddelde, reeks en waar je calorieën vandaan komen.' : `Nog ${3 - n} ${3 - n === 1 ? 'dag' : 'dagen'} loggen, dan zie je hier je week.`}</p></div></section>`; })() : ''}
  ${weekInsightHTML()}`;
}

