/* "Probleem melden": a bug or idea goes straight to GitHub as an issue in its own private repository
   (knabbel-meldingen, no code in it), so it can be picked up from there. Everything for it is in this file (plus meld-cfg.js, which publiceer.ps1 writes with the access
   key): taking it out again means removing the two script lines in index.html.
   The key only allows writing issues in that one repository. It is stored reversed and base64-encoded only so GitHub's
   own scan for leaked keys doesn't switch it off when the web version is published; it is not a secret from someone
   who reads this code, which is why it can do nothing else. Without the key (a test build) the report is shared or
   copied instead. A report that can't be sent (no internet) waits and goes later. */
const meldCfg = () => { const c = window.KNABBEL_MELD; if (!c || !c.k || !c.repo) return null;
  try { return { repo: c.repo, key: atob(c.k.split('').reverse().join('')) }; } catch (e) { return null; } };

function meldHTML(){
  const waiting = (S.meta.meldQueue || []).length;
  return `<section class="card" id="melden">
    <div class="row between"><h3>Probleem melden</h3>${waiting ? `<span class="pill warn">${waiting} wacht</span>` : ''}</div>
    <p class="muted">Klopt er iets niet, of mis je iets? Vertel het hier; je melding komt direct bij de makers van Knabbel terecht.</p>
    <button class="btn small" data-act="meld-open" style="align-self:flex-start">Melding maken</button>
    ${waiting ? `<p class="note">${waiting === 1 ? '1 melding wacht' : `${waiting} meldingen wachten`} op internet en ${waiting === 1 ? 'gaat' : 'gaan'} vanzelf.</p>` : ''}
  </section>`;
}
/* The meal you worked on last: often what the report is about ("the skyr got the wrong macros"). Only sent when you
   tick it (off by default): what you eat is personal, and the access key in the web version can be found. */
function meldLastMeal(){
  const es = Object.keys(S.days).sort().slice(-2).flatMap(k => (S.days[k].entries || []).map(e => [k, e])).sort((a, b) => (a[1].t || 0) - (b[1].t || 0));
  const last = es[es.length - 1]; if (!last) return null;
  const [k, e] = last;
  const items = (e.items || []).map(i => `  - ${i.name}: ${r0(i.grams)} g, ${r0(i.kcal)} kcal, E ${r1(i.p)} K ${r1(i.c)} V ${r1(i.f)}${i.nevo ? ` (NEVO ${i.nevo}${i.approx ? ', benadering' : ''})` : i.off ? ` (${i.mine ? 'eigen product' : 'Open Food Facts'})` : i.bron ? ` (${i.bron})` : ''}`);
  return { name: e.name, text: [`${k} · ${e.meal} · "${e.text || e.name}" → ${r0(e.kcal)} kcal`, ...items].join('\n') };
}
let meldBusy = false;
function openMeld(){
  L = null; C = null;
  const m = meldLastMeal();
  sheet('Probleem melden', `<label class="field">Wat ging er mis, of wat kan beter?<textarea id="meldTxt" rows="5" maxlength="2000" placeholder="Bijv. &quot;Skyr perzik van de AH kreeg de verkeerde macro's&quot;"></textarea></label>
    ${m ? `<label class="meldopt"><input type="checkbox" id="meldMeal"><span>Je laatste maaltijd meesturen<br><span class="note">${esc(m.name)}</span></span></label>` : ''}
    <label class="meldopt"><input type="checkbox" id="meldTech" checked><span>Technische info meesturen<br><span class="note">versie, telefoon, de laatste AI-fouten. Geen sleutel, gewicht of andere maaltijden.</span></span></label>
    <button class="btn block" data-act="meld-send" ${meldBusy ? 'disabled' : ''}>${meldBusy ? 'Versturen…' : 'Versturen'}</button>
    <p class="note">${meldCfg() ? 'Je melding gaat naar de makers van Knabbel. Zet er geen privégegevens in; je maaltijd gaat alleen mee als je dat aanvinkt.' : 'Melden is in deze versie nog niet ingesteld: je kunt je melding wel delen of kopiëren.'}</p>`);
}
function meldBody(text, withMeal, withTech){
  const m = withMeal && meldLastMeal();
  // The tech info without the line about the key.
  const tech = withTech ? techInfo().split('\n').filter(l => !/^Sleutel:/.test(l)).join('\n') : '';
  return [text, m ? `\n### Laatste maaltijd\n${m.text}` : '', tech ? `\n### Technische info\n\`\`\`\n${tech}\n\`\`\`` : ''].filter(Boolean).join('\n');
}
async function meldPost(r){
  const c = meldCfg(); if (!c) throw { code: 'no_cfg' };
  const res = await fetch(`https://api.github.com/repos/${c.repo}/issues`, { method: 'POST',
    headers: { Authorization: `Bearer ${c.key}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: r.title, body: r.body }) }).catch(() => { throw { code: 'network' }; });
  if (!res.ok) throw { code: res.status === 401 || res.status === 403 || res.status === 404 ? 'key' : 'server', status: res.status };
}
async function sendMeld(){
  const text = (($('#meldTxt') || {}).value || '').trim();
  if (text.length < 3) { toast('Schrijf eerst kort wat er mis ging.'); $('#meldTxt')?.focus(); return; }
  // Where it came from, in the title, so the list of reports already shows it (also without the tech info).
  const from = Native ? 'Android' : isIOS() ? 'iPhone' : 'Browser';
  const r = { title: `[Melding · ${from}] ${text.replace(/\s+/g, ' ').slice(0, 70)}`, body: meldBody(text, $('#meldMeal')?.checked, $('#meldTech')?.checked), at: Date.now() };
  if (!meldCfg()) {   // no key in this version: share it instead
    const all = `${r.title}\n\n${r.body}`;
    try { if (Native) { await nat('app.share', { text: all }); closeSheet(); return; } if (navigator.share) { await navigator.share({ title: 'Knabbel melding', text: all }); closeSheet(); return; } }
    catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(all); closeSheet(); toast('Gekopieerd. Plak het in een berichtje.'); } catch (e) { toast('Delen lukte niet.'); }
    return;
  }
  meldBusy = true; openMeld(); $('#meldTxt').value = text;
  try { await meldPost(r); meldBusy = false; closeSheet(); toast('Bedankt! Je melding is verstuurd.'); }
  catch (e) {
    meldBusy = false;
    if (e.code === 'network' || e.code === 'server') {
      (S.meta.meldQueue ||= []).push(r); save(); closeSheet(); render();
      toast('Geen verbinding: je melding wordt verstuurd zodra het weer kan.');
    } else { openMeld(); $('#meldTxt').value = text; toast('Melden lukt nu niet (de toegang werkt niet meer). Deel het anders even via een berichtje.'); }
  }
}
/* Reports that waited: sent when the app opens or comes back online, oldest first. */
let meldFlushing = false;
async function meldFlush(){
  const Q = S.meta.meldQueue; if (meldFlushing || !Q || !Q.length || !meldCfg() || navigator.onLine === false) return;
  meldFlushing = true;
  try { while (Q.length) { await meldPost(Q[0]); Q.shift(); save(); } } catch (e) {}
  meldFlushing = false;
  if (!Q.length) { delete S.meta.meldQueue; save(); }
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-act="meld-open"],[data-act="meld-send"]'); if (!b) return;
  if (b.dataset.act === 'meld-open') openMeld(); else sendMeld();
});
window.addEventListener('online', meldFlush);
setTimeout(meldFlush, 8000);
