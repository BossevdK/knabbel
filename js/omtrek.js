/* Body measurements (waist, hips, chest, thigh, upper arm): optional, off by default. The scale says little when you gain
   muscle or hold water; a waist that gets smaller says a lot. Everything stays on this device, in the back-up, and is
   never in a report or in a question to the AI. */
const GIRTH = [['taille', 'Taille', 'op de smalste plek, of ter hoogte van je navel'], ['heupen', 'Heupen', 'op het breedste punt van je billen'],
  ['borst', 'Borst', 'onder je oksels, over het breedste punt'], ['bovenbeen', 'Bovenbeen', 'halverwege je been'], ['bovenarm', 'Bovenarm', 'halverwege, ontspannen']];
const girthOn = () => !!(S.meta.girth && S.meta.girth.on);
const girthRows = () => ((S.meta.girth && S.meta.girth.rows) || []).slice().sort((a, b) => a.date.localeCompare(b.date));
const cmStr = v => String(r1(v)).replace('.', ',');
function girthSet(on){ const G = S.meta.girth || (S.meta.girth = { on: false, rows: [] }); G.on = on; save(); }
/* One date can hold a few measures; saving the same date again fills in or replaces those you give. Returns how many were saved. */
function girthSave(date, vals){
  const G = S.meta.girth || (S.meta.girth = { on: true, rows: [] }); if (!date || date > todayKey()) return 0;
  const m = {}; GIRTH.forEach(([id]) => { const v = num(vals[id]); if (v >= 10 && v <= 250) m[id] = r1(v); });
  if (!Object.keys(m).length) return 0;
  let row = G.rows.find(r => r.date === date); if (!row) G.rows.push(row = { date });
  Object.assign(row, m); G.rows.sort((a, b) => a.date.localeCompare(b.date)); save(); return Object.keys(m).length;
}
function girthSeries(id){ return girthRows().filter(r => r[id] != null).map(r => ({ date: r.date, v: r[id] })); }
function girthSpark(pts){
  if (pts.length < 2) return '';
  const w = 96, h = 30, vs = pts.map(p => p.v), mn = Math.min(...vs), mx = Math.max(...vs), rg = Math.max(0.5, mx - mn);
  const x = i => 3 + (w - 6) * i / (pts.length - 1), y = v => h - 4 - (h - 8) * (v - mn) / rg;
  return `<svg class="gspark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${x(pts.length - 1).toFixed(1)}" cy="${y(pts[pts.length - 1].v).toFixed(1)}" r="3" fill="var(--accent)"/></svg>`;
}
function girthHTML(){
  if (!girthOn()) return '';
  const rows = GIRTH.map(([id, label]) => { const s = girthSeries(id); if (!s.length) return '';
    const last = s[s.length - 1], first = s[0], d = last.v - first.v;
    return `<div class="grow2"><span class="grow" style="display:flex;flex-direction:column"><b>${label}</b><span class="note num">${cmStr(last.v)} cm · ${shortDate(last.date)}</span></span>${girthSpark(s)}
      <span class="num gdelta ${d < -0.04 ? 'down' : d > 0.04 ? 'up' : ''}">${s.length > 1 ? `${d > 0.04 ? '+' : d < -0.04 ? '−' : ''}${cmStr(Math.abs(d))} cm` : 'eerste'}</span></div>`; }).join('');
  const hist = girthRows().slice().reverse().slice(0, 8);
  return `<details class="card girth"${girthRows().length ? ' open' : ''}><summary class="row between"><h3>Omtrekken</h3><span class="note">${girthRows().length ? `${girthRows().length} ${girthRows().length === 1 ? 'meting' : 'metingen'}` : 'nog geen'}</span></summary>
    ${rows ? `<div class="gbody">${rows}<p class="note" style="margin:0">Het verschil is sinds je eerste meting.</p></div>` : '<p class="muted" style="margin:0">Vul hieronder een meting in. Je ziet dan per plek hoe het verandert. Ook als de weegschaal stilstaat, kan je taille kleiner worden.</p>'}
    <form id="girthForm" class="gform"><label class="field">Datum<input type="date" id="g-date" value="${todayKey()}" max="${todayKey()}"></label>
      <div class="gin">${GIRTH.map(([id, label]) => `<label class="field">${label} (cm)<input type="text" inputmode="decimal" autocomplete="off" id="g-${id}" placeholder="–"></label>`).join('')}</div>
      <button class="btn small" type="submit">Opslaan</button></form>
    <details class="more"><summary>Zo meet je het eerlijkst</summary><ul class="steps">${GIRTH.map(([, l, tip]) => `<li><b>${l}:</b> ${tip}.</li>`).join('')}</ul>
      <p class="note">Meet 's ochtends, met een soepele meter die strak maar niet knijpend zit, ontspannen uitgeademd en op de blote huid. Doe het steeds op dezelfde plek. Over een paar weken zie je verschil, niet na een dag.</p></details>
    ${hist.length ? `<details class="more"><summary>Metingen aanpassen</summary>${hist.map(r => `<div class="eq"><span class="grow"><b>${esc(shortDate(r.date))}</b><span class="note num"> ${GIRTH.filter(([id]) => r[id] != null).map(([id, l]) => `${l.toLowerCase()} ${cmStr(r[id])}`).join(' · ')}</span></span><button class="icon-btn" data-act="girth-del" data-gdate="${r.date}" aria-label="Verwijder meting van ${esc(shortDate(r.date))}" style="background:var(--surface2)">×</button></div>`).join('')}</details>` : ''}
  </details>`;
}
function girthSettingsHTML(){
  const on = girthOn();
  return `<section class="card" id="omtrekken"><div class="row between"><h3>Omtrekken bijhouden</h3><span class="pill ${on ? 'good' : 'warn'}">${on ? 'Aan' : 'Uit'}</span></div>
    <p class="muted">Meet af en toe je taille, heupen, borst, bovenbeen en bovenarm en zie op Voortgang hoe het verandert. Handig als je spier opbouwt of als je gewicht stilstaat. Dit blijft alleen op ${thisDevice()}.</p>
    <div class="seg" role="group" aria-label="Omtrekken bijhouden"><button data-gon="1" aria-pressed="${on}">Aan</button><button data-gon="0" aria-pressed="${!on}">Uit</button></div></section>`;
}
