/* How sure the numbers are: a margin on what you ate ("915 ± 90 kcal"), and the card "Klopt je logboek?" that checks your
   log against your weight. No AI questions: everything comes from what is already in the app. */

/* ---------- a margin on what you ate ---------- */
/* Every part gets a relative uncertainty from where its numbers come from (the value per 100 g) and from where its
   amount comes from (how many grams). The two add up as a square root (they are independent), and hidden fat and sauces
   (oil in the pan, a splash of dressing) are the most uncertain of all. These are estimates, not measurements: they say
   which meals and parts you can trust less, and where it pays off to weigh once. */
const UNC_VALUE = { pack: 0.04, nevo: 0.06, nevoNear: 0.15, web: 0.08, guess: 0.18, hidden: 0.4 };
const UNC_AMOUNT = { product: 0.04, nevo: 0.05, manual: 0.05, foto: 0.3, recept: 0.2, advies: 0.15, ai: 0.2 };
function itemRel(e, it){
  if (it.hidden) return UNC_VALUE.hidden;
  const v = it.off || it.mine || it.bron === 'jouw product' ? UNC_VALUE.pack
    : it.nevo ? (it.approx ? UNC_VALUE.nevoNear : UNC_VALUE.nevo)
    : it.bron && !/^schatting/i.test(it.bron) && it.bron !== 'NEVO' ? UNC_VALUE.web : UNC_VALUE.guess;
  const a = UNC_AMOUNT[e.src] ?? UNC_AMOUNT.ai;
  return Math.sqrt(v * v + a * a);
}
/* One day: the total, its margin (about 2 out of 3 times the real value lies within it), and the parts that add the most
   uncertainty. Over many parts the margin grows less than the sum (they don't all miss in the same direction), but not
   as little as if they were fully independent: you tend to guess low or high all the time. */
function dayMargin(k){
  const rows = [];
  day(k).entries.filter(e => !e.pending).forEach(e => {
    const mult = e.mult || 1, items = e.items && e.items.length ? e.items : [{ name: e.name, kcal: e.kcal / mult, whole: true }];
    items.forEach(it => { const kcal = (it.kcal || 0) * mult; if (kcal < 5) return;
      rows.push({ name: it.name || e.name, kcal, sd: kcal * (it.whole ? (e.src === 'manual' ? 0.05 : 0.15) : itemRel(e, it)), meal: e.meal, hidden: !!it.hidden, entry: e }); });
  });
  const sum = rows.reduce((a, r) => a + r.sd, 0), ind = Math.sqrt(rows.reduce((a, r) => a + r.sd ** 2, 0));
  return { total: rows.reduce((a, r) => a + r.kcal, 0), sd: Math.sqrt(ind ** 2 + (0.3 * sum) ** 2), rows: rows.sort((a, b) => b.sd - a.sd) };
}
/* "± 90", or nothing when the margin is small (under 20 kcal, or under 3%). */
function marginText(k){
  const m = dayMargin(k), sd = Math.round(m.sd / 10) * 10;
  return sd >= 20 && m.total > 0 && sd / m.total >= 0.03 ? `± ${sd}` : '';
}
const fmtK = n => r0(n).toLocaleString('nl-NL');
/* In "Je eetdoel uitgelegd": how precise what you ate is, which parts add the most, and whether your goal lies within it. */
function uncertaintyHTML(k){
  const m = dayMargin(k), sd = Math.round(m.sd / 10) * 10;
  if (!m.rows.length || sd < 20) return '';
  const lo = Math.max(0, Math.round((m.total - m.sd) / 10) * 10), hi = Math.round((m.total + m.sd) / 10) * 10, goal = budget(k).kcal;
  const verdict = k !== todayKey() ? '' : Math.abs(m.total - goal) <= m.sd ? `Je eetdoel (${fmtK(goal)} kcal) ligt binnen die marge: je zit rond je doel.`
    : m.total < goal ? `Ook met die marge zit je onder je eetdoel (${fmtK(goal)} kcal).` : `Ook met die marge zit je boven je eetdoel (${fmtK(goal)} kcal).`;
  const top = m.rows.slice(0, 3).filter(r => r.sd >= 15);
  return `<div class="card eqs unc"><b>Hoe precies is wat je at?</b>
    <div class="eq"><span>${k === todayKey() ? 'Vandaag gegeten' : 'Gegeten'}</span><b class="num">${fmtK(m.total)} kcal</b></div>
    <div class="eq"><span>Marge</span><b class="num">± ${sd} kcal</b></div>
    <p class="note" style="margin:0">Meestal ligt wat je echt at tussen ${fmtK(lo)} en ${fmtK(hi)} kcal. Een product van een verpakking of uit de NEVO-tabel is precies; de portie die de AI inschat en verborgen vet (olie, sauzen) niet. ${verdict}</p>
    ${top.length ? `<span class="eyebrow">Waar de meeste onzekerheid zit</span>${top.map(r => `<div class="eq"><span>${esc(r.name)}${r.hidden ? ' <span class="note">verborgen</span>' : ''}</span><b class="num">± ${Math.round(r.sd / 5) * 5} kcal</b></div>`).join('')}
    <p class="note" style="margin:0">Weeg het eerste onderdeel een keer, dan weet je beter hoe groot jouw portie is.</p>` : ''}</div>`;
}

/* ---------- "Klopt je logboek?" ---------- */
/* Your weight is the one check that doesn't depend on the AI: what you ate (as logged) minus what you burn is what you
   lose. Knabbel compares what the log and the formula say you should lose with what your weight really did. The gap
   is in kcal a day. It can't tell whether the log is too low or your body burns less than the formula says (it is one
   total), but your eat goal already follows it (see updateBurn), so the goal fits the way you log. */
function logCheckHTML(){
  const P = S.profile; if (!P || !firstLogKey()) return '';
  const C = logCheck(); if (!C) return '';
  const wk = v => `${v > 0.04 ? '+' : v < -0.04 ? '−' : ''}${String(r1(Math.abs(v))).replace('.', ',')} kg`;
  if (!C.ready) {
    const needD = Math.max(0, C.needDays - C.days), needS = Math.max(0, C.needSpan - C.span);
    return `<details class="card logcheck"><summary class="row between"><h3>Klopt je logboek?</h3><span class="pill off">Nog niet te zien</span></summary>
      <p class="muted">Knabbel vergelijkt wat je logt met wat je gewicht doet, en zegt je of je cijfers ongeveer kloppen. Daarvoor heeft hij wat tijd nodig:</p>
      <div class="card eqs"><div class="eq"><span>Volledig gelogde dagen</span><b class="num">${C.days} van ${C.needDays}</b></div>
      <div class="eq"><span>Dagen tussen je wegingen</span><b class="num">${C.span} van ${C.needSpan}</b></div>
      <div class="eq"><span>Wegingen</span><b class="num">${C.pts} van 3</b></div></div>
      <p class="note">${needD ? `Nog ${needD} ${needD === 1 ? 'dag' : 'dagen'} volledig loggen` : ''}${needD && (needS || C.pts < 3) ? ' en ' : ''}${needS || C.pts < 3 ? 'blijf je regelmatig wegen' : ''}${needD || needS || C.pts < 3 ? '.' : ''} De eerste 10 dagen tellen niet mee: dan verlies je vooral vocht.</p></details>`;
  }
  const g = C.gap, big = Math.abs(C.pct);
  const state = big < 0.05 ? ['good', 'Klopt goed'] : g > 0 ? [big < 0.12 ? 'off' : 'warn', big < 0.12 ? 'Iets lager dan verwacht' : 'Flink lager dan verwacht'] : [big < 0.12 ? 'off' : 'warn', 'Sneller dan verwacht'];
  const text = big < 0.05 ? 'Wat je logt en wat je gewicht doet passen goed bij elkaar. Je cijfers lijken dus te kloppen.'
    : g > 0 ? `Je gewicht gaat minder omlaag dan je logboek en de formule samen laten verwachten: zo'n ${fmtK(Math.abs(g))} kcal per dag lijkt te ontbreken. Dat kan komen doordat je iets minder logt of lager schat dan het echt is (porties worden vaak te laag ingeschat), of doordat je lichaam minder verbruikt dan de formule denkt. Dat kan ik uit je gewicht niet uit elkaar halen.`
    : `Je gewicht gaat sneller omlaag dan je logboek en de formule samen laten verwachten: zo'n ${fmtK(Math.abs(g))} kcal per dag extra. Dat kan komen doordat je lichaam meer verbruikt dan de formule denkt, of doordat je iets meer logt dan je echt eet.`;
  return `<details class="card logcheck" open><summary class="row between"><h3>Klopt je logboek?</h3><span class="pill ${state[0]}">${state[1]}</span></summary>
    <div class="card eqs"><div class="eq"><span>Volgens je logboek en de formule</span><b class="num">${wk(C.expected)} per week</b></div>
      <div class="eq"><span>Wat je gewicht deed</span><b class="num">${wk(C.actual)} per week</b></div>
      <div class="eq"><span>Verschil</span><b class="num">${big < 0.05 ? 'klein' : `${g > 0 ? '+' : '−'}${fmtK(Math.abs(g))} kcal per dag`}</b></div></div>
    <p style="margin:0">${text}</p>
    ${big >= 0.05 ? `<p style="margin:0">Je eetdoel volgt dit: hij schuift elke week hooguit 50 kcal mee met wat je gewicht laat zien (nu ${P.targets.kcal} kcal). Zo klopt hij voor de manier waarop jij logt.</p>` : ''}
    <p class="note" style="margin:0">Gebaseerd op ${C.days} volledig gelogde dagen uit de laatste 4 weken en je wegingen.${C.sure ? '' : ' Dit is nog een eerste schatting: hoe langer je logt, hoe zekerder het wordt.'} Een week zegt weinig, kijk naar het beeld over meerdere weken.</p>
  </details>`;
}
