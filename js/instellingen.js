/* Onboarding, settings, Apple Health, updates, the reminder and backups. */
/* ---------- onboarding / settings ---------- */
/* A drop-down list inside the app (the browser's own <select> opens an Android window outside the app). A button with
   the current choice; tapping it unfolds the options right under it. The choice sits in a hidden field with the same id
   the form always used, and a change is announced like a <select> would. */
function ddHTML(id, cur, options, label, attrs = ''){
  if (cur !== '' && cur != null && !options.some(([v]) => String(v) === String(cur))) options = [[cur, `${esc(String(cur))} (huidig)`], ...options];
  const sel = options.find(([v]) => String(v) === String(cur)) || options[0];
  return `<div class="field dd" data-dd="${id}"${attrs}><span class="ddl">${label}</span><input type="hidden" id="${id}" value="${esc(sel[0])}">
    <button type="button" class="ddb" aria-haspopup="listbox" aria-expanded="false"><span class="ddt">${sel[1]}</span>${CHEV}</button>
    <div class="ddlist" role="listbox" hidden>${options.map(([v, l]) => `<button type="button" role="option" data-ddv="${esc(v)}" aria-selected="${String(v) === String(sel[0])}">${l}</button>`).join('')}</div></div>`;
}
function ddPick(btn){
  const box = btn.closest('.dd'), inp = box.querySelector('input[type=hidden]');
  inp.value = btn.dataset.ddv;
  box.querySelector('.ddt').innerHTML = btn.innerHTML;
  box.querySelectorAll('[role=option]').forEach(o => o.setAttribute('aria-selected', o === btn));
  ddClose(box);
  inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
}
function ddClose(except){
  document.querySelectorAll('.dd').forEach(b => { if (b !== except) { b.querySelector('.ddlist').hidden = true; b.querySelector('.ddb').setAttribute('aria-expanded', 'false'); b.classList.remove('open'); } });
  if (except) { const l = except.querySelector('.ddlist'); l.hidden = true; except.querySelector('.ddb').setAttribute('aria-expanded', 'false'); except.classList.remove('open'); }
}
function ddToggle(btn){
  const box = btn.closest('.dd'), list = box.querySelector('.ddlist'), open = list.hidden;
  document.querySelectorAll('.dd').forEach(b => { if (b !== box) { b.querySelector('.ddlist').hidden = true; b.querySelector('.ddb').setAttribute('aria-expanded', 'false'); b.classList.remove('open'); } });
  list.hidden = !open; btn.setAttribute('aria-expanded', String(open)); box.classList.toggle('open', open);
  if (open) setTimeout(() => list.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
}
function profileHTML(){
  const p = S.profile || { sex: 'v', age: 30, height: 170, weight: 75, goalWeight: 68, activity: 1.375, goal: 'lose', rate: 0.5, water: null, notes: '' };
  const editing = !!S.profile;
  const opt = (v, cur, l) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${l}</option>`;
  const H = S.meta.health;
  return `
  ${editing ? `<div class="top"><button class="icon-btn" data-nav="${prevView}" aria-label="Terug">‹</button><h1 class="grow">Jij &amp; je doel</h1></div>
  <p class="muted">Deze gegevens gebruikt Knabbel om je eetdoel uit te rekenen. Ze blijven op ${thisDevice()}.</p>` :
  `<div class="card" style="align-items:center;text-align:center">
     <div class="pet bob" style="width:150px">${petSVG('happy', {})}</div>
     <h1>Hoi, ik ben Knabbel</h1>
     <p class="muted">Vertel iets over jezelf. Dan reken ik uit hoeveel je per dag kunt eten om je doel te halen.</p>
   </div>`}
  <form class="card" id="profileForm">
    <div class="eyebrow">Over jou</div>
    <div class="seg" role="group" aria-label="Geslacht">
      <button type="button" data-sex="v" aria-pressed="${p.sex === 'v'}">Vrouw</button>
      <button type="button" data-sex="m" aria-pressed="${p.sex === 'm'}">Man</button>
    </div>
    <input type="hidden" id="f-sex" value="${p.sex}">
    <div class="grid3">
      <label class="field">Leeftijd<input id="f-age" type="number" inputmode="numeric" min="14" max="99" value="${S.profile ? p.age : ''}" placeholder="bijv. 30" required></label>
      <label class="field">Lengte (cm)<input id="f-height" type="number" inputmode="numeric" min="120" max="230" value="${S.profile ? p.height : ''}" placeholder="bijv. 170" required></label>
      <label class="field">Gewicht (kg)<input id="f-weight" type="text" inputmode="decimal" autocomplete="off" value="${S.profile ? kgStr(p.weight) : ''}" placeholder="bijv. 75" required></label>
    </div>
    ${ddHTML('f-activity', p.activity, ACT, 'Hoe actief ben je?')}
    ${measuredMove() ? `<p class="note">${H.on ? 'Health Connect' : 'Apple Health'} staat aan. Je beweging wordt per dag gemeten, dus dit wordt alleen gebruikt als ${H.on ? 'Health Connect' : 'Apple Health'} uit staat.</p>`
      : S.meta.manualMove ? '<p class="note">Je vult je sport zelf in. Dan telt dit niet, maar je keuze bij Instellingen, Sporten zelf invullen: hoe actief je bent zonder sport.</p>' : ''}
    <div class="eyebrow" style="margin-top:6px">Je doel</div>
    <div class="grid2" id="goalGrid"${p.goal === 'lose' ? '' : ' style="grid-template-columns:1fr"'}>
      ${ddHTML('f-goal', p.goal, [['lose', 'Afvallen'], ['maintain', 'Op gewicht blijven'], ['gain', 'Aankomen'], ['muscle', 'Spieropbouw']], 'Doel')}
      ${ddHTML('f-rate', p.rate, [[0.25, '0,25 kg per week'], [0.5, '0,5 kg per week'], [0.75, '0,75 kg per week']], 'Tempo', p.goal === 'lose' ? '' : ' style="display:none"')}
    </div>
    <div class="grid2">
      <label class="field">Streefgewicht (kg)<input id="f-goalWeight" type="text" inputmode="decimal" autocomplete="off" value="${S.profile && p.goalWeight ? kgStr(p.goalWeight) : ''}" placeholder="${S.profile ? '' : 'bijv. 68'}"></label>
      <label class="field">Drinken per dag (ml)<input id="f-water" type="number" inputmode="numeric" step="250" min="500" max="5000" placeholder="automatisch" value="${p.water || ''}"></label>
    </div>
    ${moveOn() ? `<label class="field">Beweegdoel: actief verbrande kcal per dag
      <input id="f-moveGoal" type="number" inputmode="numeric" step="50" min="0" max="2000" value="${p.moveGoal ?? 300}"></label>
    <p class="note" style="margin-top:-6px">Calorieën die je verbrandt door te bewegen en te sporten, bovenop je rustverbruik. 300 kcal is ongeveer ${walkMin(300)} minuten stevig wandelen. Vul 0 in als je geen beweegdoel wilt.</p>`
    // Without Health Connect, Apple Health or entering workouts there is nothing to measure it with: kept, not shown.
    : `<input type="hidden" id="f-moveGoal" value="${p.moveGoal ?? 300}">`}
    <label class="field">Wat eet je niet of liever niet? (optioneel)<textarea id="f-notes" placeholder="Bijv. vegetarisch, geen noten, hou niet van vis">${esc(p.notes || '')}</textarea></label>
    <div id="targetPreview"></div>
    <button class="btn block" type="submit">${editing ? 'Opslaan' : 'Start met Knabbel'}</button>
    <p class="note">Berekend met de Mifflin-St Jeor-formule. Je eetdoel gaat nooit onder je persoonlijke minimum: 80% van wat je in rust verbrandt, en minstens <span id="minAbs">${p.sex === 'm' ? '1500' : '1200'}</span> kcal.${p.adjust ? ` Na je weegmomenten is je doel met ${p.adjust > 0 ? '+' : ''}${p.adjust} kcal bijgesteld.` : ''} Dit is een schatting en geen medisch advies.</p>
  </form>
`;
}
function settingsHTML(){
  const t = S.meta.theme || 'system';
  return `
  <div class="top"><button class="icon-btn" data-nav="today" aria-label="Terug">‹</button><h1 class="grow">Instellingen</h1>${miniPetHTML()}</div>
  <section class="card">
    <h3>Weergave</h3>
    <div class="seg" role="group" aria-label="Weergave">
      ${[['system', 'Systeem'], ['light', 'Licht'], ['dark', 'Donker']].map(([v, l]) => `<button data-theme-set="${v}" aria-pressed="${t === v}">${l}</button>`).join('')}
    </div>
    <p class="note">${t === 'system' ? 'Volgt de instelling van je telefoon.' : t === 'light' ? 'Altijd licht, ook als je telefoon op donker staat.' : 'Altijd donker, ook als je telefoon op licht staat.'}</p>
    <button class="btn small ghost" data-act="edit-layout" style="align-self:flex-start">⇅ Volgorde van Vandaag aanpassen</button>
  </section>
  <section class="card">
    <h3>Je panda</h3>
    <form class="ask" id="petNameForm"><input id="f-petname" maxlength="16" value="${esc(S.meta.pet.name)}" placeholder="Naam" aria-label="Naam van je panda"><button class="btn small outline" type="submit">Opslaan</button></form>
  </section>
  <button class="card row between" data-nav="profile" style="text-align:left;width:100%;flex-direction:row">
    <span class="grow"><b>Jij &amp; je doel</b><br><span class="note">Lengte, gewicht, doel en eetdoel</span></span><span class="muted" style="font-size:20px" aria-hidden="true">›</span>
  </button>
  ${foldSettings(aiSettingsHTML() + appleHTML() + healthSettingsHTML() + fastSettingsHTML() + (Native ? reminderHTML() : '') + backupHTML() + iphoneHTML() + (typeof meldHTML === 'function' ? meldHTML() : '') + aboutHTML())}`;
}
/* Each settings part with a status is one line; tap it to open. Only one is open at a time,
   and it stays open while you change something in it. */
const setOpen = new Set();
function settingToggled(el){
  if (!el.open) { setOpen.delete(el.dataset.set); return; }
  setOpen.clear(); setOpen.add(el.dataset.set);
  document.querySelectorAll('details.setx[open]').forEach(d => { if (d !== el) d.open = false; });
}
function foldSettings(html){
  return html.replace(/<section class="card"( id="(\w+)")?>\s*<div class="row between"><h3>(.*?)<\/h3>(.*?)<\/div>([\s\S]*?)<\/section>/g, (m, _, id, h, pill, body) => {
    if (id === 'about') return m;  // stays open, so "Zoek naar updates" is always one tap away
    const open = setOpen.size ? setOpen.has(h) : id === 'ai' && !S.meta.ai.key;  // AI opens by itself only until you pick something
    pill = pill.replace(/class="pill warn">(Uit|Nog niet ingesteld)</, 'class="pill off">$1<');
    return `<details class="card setx"${id ? ` id="${id}"` : ''}${open ? ' open' : ''} data-set="${h}" ontoggle="settingToggled(this)"><summary><h3>${h}</h3>${pill}${CHEV}</summary>${body}</details>`;
  });
}
function aiSettingsHTML(){
  const has = !!S.meta.ai.key;
  return `<section class="card" id="ai">
    <div class="row between"><h3>AI voor calorieën</h3><span class="pill ${has ? 'good' : 'warn'}">${has ? 'Ingesteld' : 'Nog niet ingesteld'}</span></div>
    <p class="muted">Knabbel gebruikt Google Gemini. Met een gratis sleutel kun je elke dag tientallen maaltijden laten uitrekenen, zonder creditcard.</p>
    <details class="infox"><summary><i aria-hidden="true">i</i>Wat is een sleutel?</summary><p class="note">Een sleutel is een soort wachtwoord waarmee Knabbel aan Google mag vragen om je eten uit te rekenen. Hij is gratis en staat alleen op ${thisDevice()}. Je maakt hem zelf op de site van Google; bij stap 2 zoek je de knop <b>Create API key</b>.</p></details>
    <ol class="steps">
      <li>Open <button class="add-line" data-act="open-aistudio" style="display:inline">aistudio.google.com/apikey</button> en log in met je Google-account.</li>
      <li>Tik op <b>Create API key</b> (API-sleutel maken).</li>
      <li>Kopieer de sleutel en plak hem hieronder.</li>
    </ol>
    <label class="field">Je Gemini-sleutel<input id="ai-key" type="password" autocomplete="off" value="${esc(S.meta.ai.key)}" placeholder="Plak hier je sleutel"></label>
    <label class="field">Mijn standaarden (optioneel)<textarea id="ai-prefs" rows="3" maxlength="600" placeholder="Bijv.&#10;melk = halfvolle&#10;skyr = bak van 450 g&#10;brood = volkoren, 35 g per boterham&#10;koffie altijd met een scheutje melk">${esc(S.meta.aiPrefs || '')}</textarea></label>
    <p class="note" style="margin-top:-6px">Wat je hier zet, neemt de AI altijd mee: bij eten uitrekenen en bij ideeën (bijv. de maat van een bak). Zo hoef je het niet elke keer te typen.</p>
    ${ddHTML('ai-model', S.meta.ai.model || '', [['', 'Automatisch (aanbevolen)'], ...(S.meta.ai.models || []).map(m => [m, esc(m)])], 'Model')}
    ${S.meta.ai.lastGood ? `<p class="note">Laatst gebruikt: ${esc(S.meta.ai.lastGood)}${Object.keys(S.meta.ai.cool || {}).some(isCool) ? ` · limiet op voor ${Object.keys(S.meta.ai.cool).filter(isCool).map(esc).join(', ')}, weer beschikbaar om ${hm(new Date(Math.min(...Object.values(S.meta.ai.cool).filter(t => t > Date.now()))))}` : ''}</p>` : ''}
    <div class="row"><button class="btn small" data-act="ai-save">Opslaan</button><button class="btn small ghost" data-act="ai-test">Test de sleutel</button></div>
    <div id="aiTestOut"></div>
    <p class="note">Je sleutel blijft op ${thisDevice()} en wordt alleen naar Google gestuurd. Let op: bij het gratis tegoed mag Google je vragen gebruiken om hun AI te verbeteren. Zet er dus geen privégegevens in.</p>
    ${aiStatsHTML()}
    ${aiScoresHTML()}
    ${S.meta.ai.key ? `<button class="btn small ghost" data-act="tech-share" style="align-self:flex-start">Deel technische info</button>
    <p class="note" style="margin-top:-6px">Gaat er iets mis met de AI? Stuur dit naar wie je helpt. Je sleutel en je eten gaan niet mee.</p>` : ''}
    ${window.OFF_DATE ? `<p class="note">Productgegevens van winkelproducten: <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a> (ODbL-licentie), lijst van ${esc(window.OFF_DATE)}.</p>` : ''}
    ${NEVO ? `<p class="note">Voedingswaarden: ${NEVO_REF} (Open Food Facts voor merkproducten, en websites via Google als iets niet in NEVO staat). Bron: <a href="https://nevo-online.rivm.nl" target="_blank" rel="noopener">NEVO online</a>.</p>` : ''}
  </section>`;
}
const pctHTML = () => `${ddHTML('hc-pct', S.meta.health.pct ?? 50, [[0, 'Niets (alleen tonen)'], [25, '25%'], [50, '50% (aanbevolen)'], [75, '75%'], [100, '100%']], 'Hoeveel van je verbrande calorieën mag je terug-eten?')}
      <p class="note">Verbruik wordt vaak te hoog geschat. Daarom is 50% een veilige keuze.</p>`;
function healthSettingsHTML(){
  const H = S.meta.health;
  let status = '';
  if (!Native) status = '<p class="note">Health Connect werkt alleen in de Android-app.</p>';
  else if (healthStatus === 'unavailable') status = '<div class="err">Health Connect is niet beschikbaar op deze telefoon.</div>';
  else if (healthStatus === 'update') status = '<div class="err">Health Connect moet worden geïnstalleerd of bijgewerkt. <button class="add-line" data-act="hc-install">Open Play Store</button></div>';
  else if (healthStatus === 'no_permission') status = '<div class="err">Knabbel heeft geen toegang meer tot je beweging. Tik op Verbinden om het opnieuw toe te staan.</div>';
  return `<section class="card">
    <div class="row between"><h3>Sporten zelf invullen</h3><span class="pill ${S.meta.manualMove ? 'good' : 'warn'}">${S.meta.manualMove ? 'Aan' : 'Uit'}</span></div>
    <p class="muted">Geen horloge of Health Connect? Vul dan zelf in wat je hebt gesport, bijvoorbeeld 30 minuten fietsen. Op sportdagen mag je dan wat meer eten.</p>
    <div class="seg" role="group" aria-label="Sporten zelf invullen"><button data-manualmove="1" aria-pressed="${!!S.meta.manualMove}">Aan</button><button data-manualmove="0" aria-pressed="${!S.meta.manualMove}">Uit</button></div>
    ${!H.on && S.meta.manualMove ? pctHTML() : ''}
    ${S.meta.manualMove && !measuredMove() ? `<span class="eyebrow" style="margin-top:4px">Hoe actief ben je zonder sport?</span>
      <div class="seg" role="group" aria-label="Dagelijks leven">${[[1.2, 'Vooral zittend'], [1.3, 'Veel lopen of fietsen'], [1.4, 'Staand of lichamelijk werk']].map(([v, l]) => `<button data-dailyact="${v}" aria-pressed="${(S.meta.dailyAct || 1.2) === v}">${l}</button>`).join('')}</div>
      <p class="note">Je eetdoel gaat uit van je gewone dag zonder sport. Wat je sport, komt er per dag bij.</p>` : ''}
  </section>
  ${!Native ? '' : `<section class="card">
    <div class="row between"><h3>Beweging (Health Connect)</h3><span class="pill ${H.on ? 'good' : 'warn'}">${H.on ? 'Verbonden' : 'Uit'}</span></div>
    <p class="muted">Knabbel leest je stappen, actieve calorieën, trainingen en slaap uit Health Connect (bijv. van Google Fit, Samsung Health, Fitbit of je smartwatch). Beweeg je meer, dan mag je meer eten.</p>
    ${status}
    ${H.on ? `${pctHTML()}
      <div class="row"><button class="btn small ghost" data-act="hc-refresh">Nu bijwerken</button><button class="btn small danger" data-act="hc-off">Loskoppelen</button></div>`
    : `<button class="btn block" data-act="hc-connect" ${Native ? '' : 'disabled'}>Verbinden met Health Connect</button>`}
  </section>`}`;
}
/* ---------- Apple Health (iPhone, via a Shortcut) ----------
   Safari may not read Apple Health. A Shortcut on the iPhone can: it puts today's steps, active energy and newest weight
   on the clipboard as one line of text, and Knabbel reads that line when you tap "Plak uit Apple Health".
   Numbers may come in Dutch style (8.234 steps, 63,4 kg) and with units; both are understood. */
function nlNum(s){
  s = String(s || '').replace(/\s/g, '');
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s); return isFinite(n) ? n : null;
}
function parseApple(txt){
  const t = String(txt || ''), get = re => { const m = t.match(re); return m ? nlNum(m[1]) : null; };
  const N = '([\\d.,]+(?:\\s\\d{3})*)';
  const steps = get(new RegExp('(?:stappen|steps)\\s*[:=]?\\s*' + N, 'i'));
  const active = get(new RegExp('(?:actief|actieve energie|active(?: energy)?)\\s*[:=]?\\s*' + N, 'i'));
  const kg = get(new RegExp('(?:gewicht|weight)\\s*[:=]?\\s*' + N, 'i'));
  const out = {};
  if (steps != null && steps >= 0 && steps < 200000) out.steps = Math.round(steps);
  if (active != null && active >= 0 && active < 10000) out.kcal = Math.round(active);
  if (kg != null && kg >= 30 && kg <= 300) out.kg = r1(kg);
  return Object.keys(out).length ? out : null;
}
function applyApple(v){
  const k = todayKey(), d = ensureDay(k), m = d.move || {};
  if (v.steps != null || v.kcal != null)
    d.move = { steps: v.steps ?? m.steps ?? 0, kcal: v.kcal ?? m.kcal ?? 0, total: 0, min: m.min || 0, sessions: m.sessions || [], sleep: m.sleep || 0, at: Date.now(), src: 'apple' };
  const first = !appleOn();
  S.meta.apple = { on: true, at: Date.now() };
  if (v.kg) { S.meta.weights = S.meta.weights.filter(w => w.date !== k).concat({ date: k, kg: v.kg }); S.profile.weight = v.kg; }
  retarget(); if (v.kg) updateBurn(); save(); checkMoveGoal(); closeSheet(); render();
  const parts = [v.steps != null && `${v.steps.toLocaleString('nl-NL')} stappen`, v.kcal != null && `${v.kcal} kcal actief`, v.kg && `${kgStr(v.kg)} kg`].filter(Boolean);
  toast(`${first ? 'Apple Health staat aan. ' : ''}Bijgewerkt: ${parts.join(', ')}`);
}
async function pasteApple(){
  let txt = '';
  try { txt = await navigator.clipboard.readText(); } catch (e) {}
  const v = parseApple(txt);
  if (v) return applyApple(v);
  L = null; C = null;
  sheet('Plak uit Apple Health', `
    <p class="muted">${txt ? 'Op het klembord staat geen Knabbel-regel.' : 'Ik kon het klembord niet lezen.'} Draai eerst je Opdracht <b>Knabbel</b>, of plak de regel hieronder.</p>
    <label class="field">Regel van je Opdracht<textarea id="appleTxt" rows="2" placeholder="Knabbel stappen: 8234 actief: 412 gewicht: 63,4"></textarea></label>
    <button class="btn block" data-act="apple-apply">Gebruiken</button>
    <button class="btn block ghost" data-act="close">Annuleren</button>`);
}
function appleHTML(){
  if (Native) return '';
  const on = appleOn();
  return `<section class="card" id="apple">
    <div class="row between"><h3>Beweging uit Apple Health</h3><span class="pill ${on ? 'good' : 'warn'}">${on ? 'Aan' : 'Uit'}</span></div>
    <p class="muted">Knabbel kan Apple Health niet zelf lezen (dat mag een website niet). Met een <b>Opdracht</b> op je iPhone gaat het toch: die zet je stappen, actieve kcal en gewicht van vandaag klaar, en jij tikt in Knabbel op <b>Plak uit Apple Health</b>.</p>
    <details class="more"><summary>Zo maak je de Opdracht (eenmalig, 5 minuten)</summary>
      <ol class="steps">
        <li>Open de app <b>Opdrachten</b> en tik op <b>+</b>. Noem hem <b>Knabbel</b>.</li>
        <li>Voeg <b>Zoek naar gezondheidsgegevens</b> toe. Kies type <b>Stappen</b>, filter <b>Begindatum is vandaag</b>.</li>
        <li>Voeg <b>Bereken statistieken</b> toe en kies <b>Som</b>. Tik later op dit resultaat om het <b>Stappen</b> te noemen.</li>
        <li>Herhaal stap 2 en 3 met type <b>Actieve energie</b>. Noem dat resultaat <b>Actief</b>.</li>
        <li>Voeg nog een <b>Zoek naar gezondheidsgegevens</b> toe met type <b>Gewicht</b>, filter <b>Begindatum is vandaag</b>, sorteer op <b>nieuwste eerst</b> en zet <b>Beperk</b> aan op <b>1</b>. Zo komt alleen een weging van vandaag mee.</li>
        <li>Voeg <b>Tekst</b> toe en zet erin: <code>Knabbel stappen: [Stappen] actief: [Actief] gewicht: [Gewicht]</code>. De woorden tussen haken kies je uit de blauwe knopjes boven het toetsenbord.</li>
        <li>Voeg <b>Kopieer naar klembord</b> toe.</li>
        <li>Draai de Opdracht één keer en sta toegang tot Gezondheid toe.</li>
      </ol>
      <p class="note">Handig: zet de Opdracht op je beginscherm naast Knabbel, of maak bij <b>Automatisering</b> een vaste tijd aan (bijv. 's avonds). Daarna open je Knabbel en tik je op Plak uit Apple Health. De namen in Opdrachten kunnen per iOS-versie iets anders zijn. Weeg je niet met een slimme weegschaal, laat dan stap 5 weg.</p>
    </details>
    <button class="btn small" data-act="apple-paste" style="align-self:flex-start">❤️ Plak uit Apple Health</button>
    ${on ? `${pctHTML()}
    <p class="note">Je eetdoel gaat nu uit van een zittende dag, en wat je beweegt komt er per dag bij (net als met een horloge). Plak dus elke dag, anders telt je beweging die dag niet mee.</p>
    <button class="btn small ghost" data-act="apple-off" style="align-self:flex-start">Uitzetten</button>` : ''}
  </section>`;
}
function fastSettingsHTML(){
  const on = fastOn();
  return `<section class="card">
    <div class="row between"><h3>Vasten bijhouden</h3><span class="pill ${on ? 'good' : 'warn'}">${on ? 'Aan' : 'Uit'}</span></div>
    <p class="muted">Houd bij hoe lang je niet eet, bijvoorbeeld 16 uur. Staat dit aan, dan zie je op Vandaag een tegel Vasten.</p>
    <div class="seg" role="group" aria-label="Vasten bijhouden"><button data-faston="1" aria-pressed="${on}">Aan</button><button data-faston="0" aria-pressed="${!on}">Uit</button></div>
  </section>`;
}
function backupHTML(){
  const lb = S.meta.lastBackup;
  const ago = lb ? daysBetween(lb, todayKey()) : null;
  return `<section class="card" id="backup">
    <div class="row between"><h3>Back-up</h3><span class="pill ${lb && ago < 30 ? 'good' : 'warn'}">${lb ? (ago === 0 ? 'Vandaag' : `${ago} ${ago === 1 ? 'dag' : 'dagen'} geleden`) : 'Nog nooit'}</span></div>
    <p class="muted">Je gegevens staan alleen op ${thisDevice()}. Bewaar een back-up-bestand, bijvoorbeeld in Google Drive, zodat je niets kwijtraakt.</p>
    ${autoBackupHTML()}
    <div class="row wrap"><button class="btn small${autoOn() ? ' ghost' : ''}" data-act="backup-save">Back-up opslaan</button><button class="btn small ghost" data-act="backup-open">Terugzetten</button></div>
    <p class="note">Je AI-sleutel gaat niet mee in een back-up.</p>
    <details class="more-rows" ontoggle="if(this.open)snapsHTMLFill()"><summary>Herstelpunten op ${thisDevice()} ›</summary>
      <p class="note">Knabbel bewaart zelf elke dag hoe alles was bij het openen: de laatste 7 dagen, en daarvoor één per week. Handig als je per ongeluk iets wist. ${Native ? 'Ze staan in de app, dus kies ook een map hierboven voor als je telefoon kwijtraakt.' : `Ze staan in ${isIOS() ? 'Safari' : 'je browser'}, dus maak voor de zekerheid ook af en toe een back-up-bestand.`}</p>
      <div id="snapList" class="col"></div></details>
    <input type="file" id="restoreFile" accept="application/json,.json,text/plain" hidden>
  </section>`;
}
/* ---------- updates via internet (new APK from GitHub) ---------- */
let APPV = null, updBusy = false, updPct = null;
const updateReady = () => !!(APPV && S.meta.update && S.meta.update.code > APPV.code && S.meta.update.apk);
/* The web version (for iPhone users): the same app, on GitHub Pages next to the Android updates. */
const WEB_URL = () => { const repo = (APPV && APPV.repo) || 'BossevdK/knabbel', [o, n] = repo.split('/'); return Native ? `https://${o.toLowerCase()}.github.io/${n}/` : location.origin + location.pathname; };
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function iphoneHTML(){
  if (Native) return `<section class="card">
    <div class="row between"><h3>Knabbel voor iPhone</h3><span class="pill good">Link</span></div>
    <p class="muted">Ken je iemand met een iPhone? Met deze link kan die Knabbel ook gebruiken, in Safari. Daar zet je hem op je beginscherm, dan werkt hij als een app.</p>
    <p class="note" style="word-break:break-all">${esc(WEB_URL())}</p>
    <button class="btn small" data-act="share-web" style="align-self:flex-start">Link delen</button>
    <p class="note">Op een iPhone werkt bijna alles: loggen met de AI, barcode en foto (via een foto), zoeken, Kan dit, ideeën en Knabbel zelf. Wat niet kan: Health Connect, meldingen en recepten delen naar Knabbel. Iedereen gebruikt een eigen gratis AI-sleutel.</p>
  </section>`;
  return `<section class="card">
    <div class="row between"><h3>Knabbel als app</h3>${standalone() ? '<span class="pill good">Op je beginscherm</span>' : ''}</div>
    ${standalone() ? '<p class="muted">Knabbel staat op je beginscherm. Je gegevens blijven op deze telefoon bewaard.</p>'
      : `<p class="muted">${isIOS() ? 'Tik in Safari onderaan op <b>Deel</b> (het vierkantje met het pijltje) en kies <b>Zet op beginscherm</b>.' : 'Kies in het menu van je browser <b>Toevoegen aan startscherm</b>.'} Dan werkt Knabbel als een app en blijven je gegevens goed bewaard.</p>`}
    <p class="note">Je gegevens staan alleen op ${thisDevice()}. Maak af en toe een back-up (hierboven), dan raak je niets kwijt.</p>
    <button class="btn small ghost" data-act="share-web" style="align-self:flex-start">Link delen</button>
  </section>`;
}
async function shareWeb(){
  const url = WEB_URL(), text = `Probeer Knabbel, een calorieteller met een rode panda: ${url}`;
  try {
    if (Native) await nat('app.share', { text });
    else if (navigator.share) await navigator.share({ title: 'Knabbel', text: 'Probeer Knabbel, een calorieteller met een rode panda', url });
    else { await navigator.clipboard.writeText(url); toast('Link gekopieerd'); }
  } catch (e) {}
}
/* The web version (iPhone): an app on the home screen often stays on the version it was last opened with, until it is
   closed completely. So the page itself looks whether there is a newer one, and shows which version this is. */
const webVersion = () => { const me = document.querySelector('script[src*="start.js"]'); return me ? (me.src.split('?v=')[1] || '') : ''; };
let webNew = null, webCheckAt = 0;
async function checkWebUpdate(force){
  if (Native || location.protocol !== 'https:' || navigator.onLine === false) return;
  const cur = webVersion(); if (!cur) return;
  if (!force && Date.now() - webCheckAt < 30 * 60000) return;
  webCheckAt = Date.now();
  try {
    const t = await fetch(location.pathname, { cache: 'no-store' }).then(r => r.text()), m = t.match(/js\/start\.js\?v=([^"']+)/);
    webNew = m && m[1] !== cur ? m[1] : null;
    if (webNew && !sheetOpen() && view === 'today') render();
  } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkWebUpdate(); });
setTimeout(checkWebUpdate, 4000);
function aboutHTML(){
  if (!Native) return webVersion() ? `<section class="card" id="about">
    <div class="row between"><h3>Over Knabbel</h3>${webNew ? '<span class="pill warn">Update klaar</span>' : ''}</div>
    <p class="muted">Versie ${esc(webVersion())}</p>
    <button class="btn small${webNew ? '' : ' ghost'}" data-act="web-update" style="align-self:flex-start">${webNew ? 'Nu verversen' : 'Zoek naar updates'}</button>
    <p class="note">Op de iPhone blijft Knabbel soms op een oudere versie staan tot je hem helemaal afsluit. Hier ververs je hem meteen.</p>
  </section>` : '';
  const U = S.meta.update;
  return `<section class="card" id="about">
    <div class="row between"><h3>Over Knabbel</h3>${updateReady() ? '<span class="pill warn">Update klaar</span>' : ''}</div>
    <p class="muted">Versie ${esc(APPV ? APPV.name : '…')}</p>
    ${APPV && !APPV.repo ? '<p class="note">Updates via internet zijn nog niet ingesteld.</p>'
      : updateReady() ? `<p>Versie <b>${esc(U.name)}</b> staat klaar.${U.notes ? ' ' + esc(U.notes) : ''}</p><button class="btn small" data-act="update-install" style="align-self:flex-start" ${updBusy ? 'disabled' : ''}>${updBusy ? updLabel() : 'Nu bijwerken'}</button>`
      : `<button class="btn small ghost" data-act="update-check" style="align-self:flex-start" ${updBusy ? 'disabled' : ''}>Zoek naar updates</button>`}
    <p class="note">Knabbel kijkt één keer per dag of er een nieuwe versie is. Je gegevens blijven gewoon staan bij het bijwerken.</p>
  </section>`;
}
const updLabel = () => updPct == null ? 'Bezig…' : `Downloaden… ${updPct}%`;
window.onUpdateProgress = pct => { updPct = pct; document.querySelectorAll('[data-act="update-install"]').forEach(b => b.textContent = updLabel()); };
async function checkUpdate(force){
  if (!Native || !APPV || !APPV.repo) return;
  if (!force && Date.now() - (S.meta.updCheckAt || 0) < 20 * 3.6e6) return;
  if (force) { updBusy = true; render(); }
  try {
    const r = await nat('update.check');
    S.meta.updCheckAt = Date.now();
    if (r && Number(r.code) > APPV.code && r.apk) S.meta.update = { code: Number(r.code), name: String(r.name || ''), notes: String(r.notes || '').slice(0, 300), apk: String(r.apk) };
    else delete S.meta.update;
    save();
    if (force) toast(updateReady() ? `Versie ${S.meta.update.name} staat klaar.` : 'Je hebt de nieuwste versie.');
  } catch (e) { if (force) toast('Zoeken naar updates lukte niet. Heb je internet?'); }
  updBusy = false;
  if (!sheetOpen()) render();
}
async function installUpdate(){
  if (!updateReady() || updBusy) return;
  updBusy = true; updPct = null; render();
  try {
    const r = await nat('update.install', { url: S.meta.update.apk });
    if (r === 'need_permission') {
      L = null; C = null;
      sheet('Nog één keer toestaan', `
        <p>Android vraagt of Knabbel updates mag installeren. Zet <b>Toestaan vanaf deze bron</b> aan, ga terug naar Knabbel en tik nog een keer op <b>Nu bijwerken</b>.</p>
        <p class="note">Dit hoeft maar één keer. Knabbel installeert alleen zijn eigen updates.</p>
        <button class="btn block" data-act="close">Oké</button>`);
    }
  } catch (e) { toast(String(e).includes('bad_apk') ? 'De download klopt niet. Probeer het later opnieuw.' : 'Downloaden lukte niet. Heb je internet?'); }
  updBusy = false; updPct = null;
  if (!sheetOpen()) render();
}

/* ---------- one optional reminder a day ---------- */
function reminderHTML(){
  const R = S.meta.reminder || { on: false, time: '20:00' };
  return `<section class="card">
    <div class="row between"><h3>Herinnering om te loggen</h3><span class="pill ${R.on ? 'good' : 'warn'}">${R.on ? 'Aan' : 'Uit'}</span></div>
    <p class="muted">Eén melding per dag, alleen als je die dag nog niets hebt gelogd of de laatste 4 uur niets meer.</p>
    <div class="seg" role="group" aria-label="Herinnering"><button data-remind="1" aria-pressed="${R.on}">Aan</button><button data-remind="0" aria-pressed="${!R.on}">Uit</button></div>
    ${R.on ? `<label class="field">Hoe laat?<input id="remind-time" type="time" value="${esc(R.time)}"></label>` : ''}
    ${Native ? '' : '<p class="note">Meldingen werken alleen in de Android-app.</p>'}
  </section>`;
}
function syncReminder(){
  const R = S.meta.reminder; if (!Native || !R) return;
  const [h, m] = (R.time || '20:00').split(':').map(Number);
  nat('reminder.set', { on: !!R.on, minute: (h || 0) * 60 + (m || 0) }).catch(() => {});
}

function backupData(){
  const data = JSON.parse(JSON.stringify(S));
  if (data.meta && data.meta.ai) { data.meta.ai.key = ''; delete data.meta.ai.cool; }
  if (data.meta) delete data.meta.autoBackup;   // the folder permission belongs to this phone only
  return JSON.stringify({ app: 'knabbel', v: 2, at: new Date().toISOString(), data });
}
async function saveBackup(){
  const name = `knabbel-backup-${todayKey()}.json`;
  try {
    let ok;
    if (Native) ok = await nat('backup.save', { name, text: backupData() });
    else {
      try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([backupData()], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
      catch (e) { await navigator.clipboard.writeText(backupData()); toast('Back-up gekopieerd: plak hem in een notitie.'); }
      ok = true;
    }
    if (!ok) return;
    S.meta.lastBackup = todayKey(); save(); render(); toast('Back-up opgeslagen');
  } catch (e) { toast('Opslaan van de back-up lukte niet.'); }
}
function askRestore(raw){
  let j; try { j = JSON.parse(raw); } catch (e) { j = null; }
  if (!j || j.app !== 'knabbel' || !j.data) { toast('Dit is geen Knabbel-back-up.'); return; }
  const n = Object.values(j.data.days || {}).reduce((a, d) => a + (d.entries || []).length, 0);
  pendingRestore = j;
  L = null; C = null;
  sheet('Back-up terugzetten', `
    <p>Back-up van <b>${esc(new Date(j.at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }))}</b> met ${n} maaltijden.</p>
    <div class="err">Dit vervangt alles wat nu in de app staat.</div>
    <button class="btn block danger" data-act="backup-restore">Terugzetten</button>
    <button class="btn block ghost" data-act="close">Annuleren</button>`);
}
let pendingRestore = null;
/* Replace everything with a backup. Your AI key and this phone's backup folder stay. */
function restoreData(data){
  const key = S.meta.ai.key, auto = S.meta.autoBackup;
  Object.keys(S.meta).forEach(k => { if (k !== 'ai') delete S.meta[k]; });
  applyData(data);
  if (!S.meta.ai.key) S.meta.ai.key = key;
  if (auto) S.meta.autoBackup = auto;
  retarget(); save(); view = 'today'; dayKey = todayKey(); render();
}

/* ---------- automatic backup ----------
   1. Restore points in the app itself, without you doing anything: the state at the start of each day, the last 7 days
      plus one per week for 4 weeks. Android keeps them as files in the app, the web version in IndexedDB.
   2. Android: a folder you pick once (Google Drive, Downloads ...). After every change knabbel-backup.json there is
      brought up to date (at most every 2 minutes, and right away when you leave the app), so a new phone or a
      reinstalled app can get everything back. The AI key never goes along. */
const SNAP_KEEP_DAYS = 7, SNAP_KEEP_WEEKS = 4;
const nativeSnaps = Native && typeof Native.snapSave === 'function';
let idbP = null;
function idb(){
  if (!idbP) idbP = new Promise((ok, no) => {
    if (!window.indexedDB) return no(new Error('no indexedDB'));
    const r = indexedDB.open('knabbel', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('snaps');
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
  return idbP;
}
async function idbDo(mode, fn){
  const db = await idb();
  return new Promise((ok, no) => { const tx = db.transaction('snaps', mode), st = tx.objectStore('snaps'); const r = fn(st); tx.oncomplete = () => ok(r && r.result); tx.onerror = () => no(tx.error); });
}
const snapStore = {
  async list(){ if (nativeSnaps) { try { return JSON.parse(Native.snapList()) || []; } catch (e) { return []; } }
    try { return ((await idbDo('readonly', st => st.getAllKeys())) || []).map(String).sort().reverse(); } catch (e) { return []; } },
  async save(day, text){ if (nativeSnaps) return Native.snapSave(day, text); try { await idbDo('readwrite', st => st.put(text, day)); return true; } catch (e) { return false; } },
  async load(day){ if (nativeSnaps) return Native.snapLoad(day); try { return await idbDo('readonly', st => st.get(day)); } catch (e) { return ''; } },
  async del(day){ if (nativeSnaps) return Native.snapDelete(day); try { await idbDo('readwrite', st => st.delete(day)); } catch (e) {} }
};
/* Which restore points to keep: the newest 7 days, and of the older ones the newest per week, for 4 weeks. */
function snapsToKeep(days){
  const keep = new Set(days.slice(0, SNAP_KEEP_DAYS)), weeks = new Set();
  days.slice(SNAP_KEEP_DAYS).forEach(d => {
    const wk = Math.floor(daysBetween('2020-01-06', d) / 7);   // weeks from a Monday
    if (weeks.size < SNAP_KEEP_WEEKS && !weeks.has(wk)) { weeks.add(wk); keep.add(d); }
  });
  return keep;
}
let snapDay = null;
/* Once a day, before the first change: a copy of how everything was at the start of the day. */
async function snapshotToday(){
  const tk = todayKey(); if (!S.profile || snapDay === tk) return;
  snapDay = tk;
  const text = backupData();   // right now, before the app changes anything after opening
  try {
    const days = await snapStore.list();
    if (!days.includes(tk)) await snapStore.save(tk, text);
    const all = days.includes(tk) ? days : [tk, ...days], keep = snapsToKeep(all);
    for (const d of all) if (!keep.has(d)) await snapStore.del(d);
  } catch (e) {}
}
async function snapsHTMLFill(){
  const el = document.getElementById('snapList'); if (!el) return;
  const days = await snapStore.list();
  el.innerHTML = days.length ? days.map(d => `<button class="add-line" data-snap="${esc(d)}">${d === todayKey() ? 'Begin van vandaag' : d === shiftKey(todayKey(), -1) ? 'Begin van gisteren' : esc(shortDate(d))}</button>`).join('')
    : '<p class="note">Je eerste herstelpunt komt de volgende keer dat je Knabbel opent.</p>';
}
/* Android: the folder backup. */
let autoT = null, autoBusy = false;
const autoOn = () => !!(Native && S.meta.autoBackup && S.meta.autoBackup.uri);
function autoBackupSoon(now){
  if (!autoOn()) return;
  clearTimeout(autoT);
  const since = Date.now() - (S.meta.autoBackup.at || 0);
  autoT = setTimeout(autoBackupNow, now ? 0 : Math.max(5000, 120000 - since));
}
async function autoBackupNow(){
  autoT = null;
  if (!autoOn() || autoBusy) return; autoBusy = true;
  const A = S.meta.autoBackup;
  try {
    await nat('autobackup.write', { uri: A.uri, name: 'knabbel-backup.json', text: backupData() });
    A.at = Date.now(); A.err = ''; S.meta.lastBackup = todayKey();
  } catch (e) { A.err = String((e && e.message) || e || 'mislukt').slice(0, 80); }
  autoBusy = false; save(true);
}
function autoBackupHTML(){
  if (!Native) return '';
  const A = S.meta.autoBackup;
  if (!A || !A.uri) return `<div class="card" style="background:var(--surface2)"><b>Automatische back-up</b>
    <p class="note">Kies één keer een map, bijvoorbeeld in Google Drive. Daarna houdt Knabbel daar zelf een back-up bij, na elke wijziging. Krijg je een nieuwe telefoon, dan zet je hem met Terugzetten weer terug.</p>
    <button class="btn small" data-act="auto-pick" style="align-self:flex-start">Map kiezen</button></div>`;
  const when = A.at ? new Date(A.at).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'nog niet';
  return `<div class="card" style="background:var(--surface2)"><div class="row between"><b>Automatische back-up</b><span class="pill ${A.err ? 'warn' : 'good'}">${A.err ? 'Mislukt' : 'Aan'}</span></div>
    <p class="note">Naar <b>${esc(A.name || 'gekozen map')}</b> › knabbel-backup.json · laatst bijgewerkt: ${esc(when)}</p>
    ${A.err ? `<p class="note">Schrijven lukte niet (${esc(A.err)}). Kies de map opnieuw.</p>` : ''}
    <div class="row wrap"><button class="btn small ghost" data-act="auto-pick">Andere map</button><button class="btn small ghost" data-act="auto-off">Uitzetten</button></div></div>`;
}
/* The web version: ask the browser to keep this site's storage, so Safari doesn't clear it when space runs low. */
if (!Native && navigator.storage && navigator.storage.persist) { try { navigator.storage.persist().catch(() => {}); } catch (e) {} }
/* The web version keeps its own files on the phone (sw.js), so it also opens without internet. Not in the Android app:
   that has the files inside the app already. */
if (!Native && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (autoT) autoBackupSoon(true); }
  else snapshotToday();
});

/* Everything needed to see what goes wrong with the AI on someone else's phone, as plain text to send over.
   No key, no food: only versions, models, counts and Google's error messages. */
function techInfo(){
  const A = S.meta.ai, st = A.stats || {}, now = Date.now(), t = x => new Date(x).toLocaleString('nl-NL');
  const today = st.day === todayKey();
  const live = o => Object.entries(o || {}).filter(([, v]) => v > now).map(([m, v]) => `${m} tot ${t(v)}`).join(', ') || '-';
  return [
    `Knabbel ${APPV ? APPV.name + ' (' + APPV.code + ')' : 'web'} · ${Native ? 'Android-app' : isIOS() ? 'iPhone (Safari)' : 'browser'} · ${t(now)}`,
    navigator.userAgent,
    `Sleutel: ${A.key ? 'ingevuld (' + A.key.trim().length + ' tekens)' : 'leeg'} · Model: ${A.model || 'automatisch'} · laatst goed: ${A.lastGood || '-'}`,
    `Modellen (${(A.models || []).length}): ${(A.models || []).join(', ') || '-'}`,
    `Vandaag: ${today ? `${st.ok || 0} goed, ${st.busy || 0} druk, ${st.rate_limited || 0} limiet, ${st.slow || 0} te traag, ${st.err || 0} anders` : 'nog niets'}`,
    `Per soort: ${Object.entries((today && st.kinds) || {}).map(([k, v]) => `${k} ${v.n}x/${v.fail} mislukt`).join(', ') || '-'}`,
    `Verbruikt: ${Object.entries(aiUse().n).map(([m, v]) => `${m} ${v}/${dayLimit(m)}`).join(', ') || '-'}`,
    `Snelheid: ${Object.entries(A.lat || {}).map(([m, v]) => `${m} ${r1(v / 1000)}s`).join(', ') || '-'}`,
    `Modelscores: ${(A.models || []).filter(textModel).map(m => `${m} ${modelScore(m)}`).join(', ') || '-'}`,
    `Per taak: ${Object.entries(A.ks || {}).map(([k, K]) => `${k} ${K.n}x/${K.n - K.ok} mislukt${K.ms ? ` ${r1(K.ms / 1000)}s` : ''}${K.up != null ? ` up ${r1(K.up / 1000)}s` : ''}${K.wait != null ? ` gemini ${r1(K.wait / 1000)}s` : ''}${K.kb ? ` ${K.kb}KB` : ''} ${r1(K.tries / K.n)} extra`).join(', ') || '-'}`,
    `Vaak druk: ${Object.keys(A.busy || {}).filter(m => busyRate(m) >= 0.05).map(m => `${m} ${Math.round(busyRate(m) * 100)}%`).join(', ') || '-'}`,
    `Limiet op: ${live(A.cool)} · Overgeslagen: ${live(A.gone)} · Zoeken gepauzeerd: ${A.searchCool > now ? t(A.searchCool) : '-'}`,
    `Zonder schema: ${Object.keys(A.plain || {}).join(', ') || '-'} · Denken: ${Object.entries(A.think || {}).map(([m, v]) => `${m}=${v}`).join(', ') || '-'} · Kan niet zoeken: ${Object.keys(A.noSearch || {}).join(', ') || '-'}`,
    'Laatste fouten:',
    ...((A.errs || []).map(e => `- ${t(e.at)} · ${e.kind} · ${e.model || '?'} · ${e.code}${e.msg ? ': ' + e.msg : ''}`)),
    (A.errs || []).length ? '' : '- geen',
  ].join('\n').trim();
}
async function shareTechInfo(){
  const text = techInfo();
  try {
    if (Native) { await nat('app.share', { text }); return; }
    if (navigator.share) { await navigator.share({ title: 'Knabbel technische info', text }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast('Gekopieerd. Plak het in een berichtje.'); }
  catch (e) { toast('Delen lukte niet.'); }
}
/* "deze telefoon" in the app and on a phone, "dit apparaat" in a browser on a computer or tablet. */
const thisDevice = () => Native || isIOS() || /Android|Mobile/i.test(navigator.userAgent) ? 'deze telefoon' : 'dit apparaat';
function readProfileForm(){
  const g = id => $('#f-' + id)?.value;
  return { sex: g('sex'), age: num(g('age')), height: num(g('height')), weight: num(g('weight')), goalWeight: num(g('goalWeight')) || null,
    activity: Number(g('activity')), goal: g('goal'), rate: Number(g('rate')), water: num(g('water')) || null, notes: (g('notes') || '').slice(0, 400),
    adjust: S.profile?.adjust || 0, burn: S.profile?.burn || null, moveGoal: ($('#f-moveGoal')?.value ?? '') === '' ? 0 : r0(num($('#f-moveGoal').value)) };
}
/* Safety limits: never a goal weight below a healthy weight, never faster than 1% of your weight per week. */
/* The fastest pace from the list that stays within 1% of your weight per week. */
const rateStr = r => String(r).replace('.', ',');
const safeRate = w => [0.75, 0.5, 0.25].find(r => r <= w * 0.01) || 0.25;
function profileWarnings(p){
  const out = [], h2 = (p.height / 100) ** 2;
  if (p.goal === 'lose' && p.goalWeight && p.height && p.goalWeight / h2 < 18.5) out.push(`Je streefgewicht is ondergewicht voor jouw lengte. Kies minimaal ${Math.ceil(18.5 * h2)} kg.`);
  if (p.goal === 'lose' && p.weight && p.rate > p.weight * 0.01) out.push(`${String(p.rate).replace('.', ',')} kg per week is meer dan 1% van je gewicht. Dat kost vaak spiermassa; kies liever ${rateStr(safeRate(p.weight))} kg per week.`);
  if (p.goal === 'lose' && p.weight && p.height && p.weight / h2 < 18.5) out.push('Je hebt nu al ondergewicht voor jouw lengte. Afvallen is dan niet gezond; overleg met je huisarts.');
  return out;
}
function updateTargetPreview(){
  const el = $('#targetPreview'); if (!el) return;
  const p = readProfileForm();
  const mA = $('#minAbs'); if (mA) mA.textContent = p.sex === 'm' ? '1500' : '1200';   // follows Vrouw / Man
  // The pace only counts when losing weight: gaining and building muscle have their own fixed, slow pace.
  const rl = $('#f-rate')?.closest('.field'); if (rl) { rl.style.display = p.goal === 'lose' ? '' : 'none'; const gg = $('#goalGrid'); if (gg) gg.style.gridTemplateColumns = p.goal === 'lose' ? '' : '1fr'; }
  if (!p.age || !p.height || !p.weight) { el.innerHTML = ''; return; }
  const t = calcTargets(p), warn = profileWarnings(p);
  if (p.goal === 'lose' && t.effRate < p.rate - 0.01) warn.push(t.effRate < 0.05
    ? `Afvallen door minder te eten lukt bij jou zo niet: je minimum van ${t.floor} kcal ligt al bij je verbruik (± ${t.tdee} kcal). Beweeg meer, of kies "Op gewicht blijven".`
    : `Je minimum van ${t.floor} kcal laat hooguit ${kgStr(t.effRate)} kg per week toe. Je schema rekent daarmee.`);
  el.innerHTML = `${warn.map(w => `<div class="err">${w}</div>`).join('')}<div class="sum"><div><b class="num">${t.kcal}</b><span>eetdoel kcal</span></div><div><b class="num">${t.p}</b><span>eiwit g</span></div><div><b class="num">${t.c}</b><span>koolh. g</span></div><div><b class="num">${t.fMin}–${t.f}</b><span>vet g</span></div></div>
  ${p.water ? '' : `<p class="note num">Drinken: ${clamp(Math.round(t.refW * WATER_PER_KG / 50) * 50, 1500, 4000)} ml per dag (${WATER_PER_KG} ml per kg van je gezonde gewicht, ${t.refW} kg), meer op dagen dat je veel beweegt. Vul zelf een getal in als je dat liever hebt.</p>`}
  <p class="note">Je verbruikt ongeveer ${t.tdee} kcal per dag${moveOn() ? ', plus wat je extra beweegt' : ''}. Je <b>eetdoel</b> van ${t.kcal} kcal is hoeveel je per dag mag eten om ${p.goal === 'lose' ? kgStr(t.effRate) + ' kg per week af te vallen' : p.goal === 'muscle' ? 'spieren op te bouwen' : isGain(p.goal) ? 'rustig aan te komen' : 'op gewicht te blijven'}.${t.floored ? ` Hij gaat nooit onder ${t.floor} kcal, zodat je genoeg binnenkrijgt. Daarom is ${kgStr(t.effRate)} kg per week haalbaar in plaats van ${rateStr(p.rate)} kg.` : ''}</p>
  ${p.goal === 'muscle' ? `<p class="note"><b>Spieropbouw</b> werkt alleen samen met <b>krachttraining</b> (2 à 3 keer per week). Je eet ${t.change} kcal per dag boven je verbruik en ${t.p} g eiwit (${t.perKg} g per kg). Zo kom je ± 0,2 kg per week aan, met zo weinig mogelijk vet. Train je niet, kies dan "Op gewicht blijven" of "Aankomen".</p>` : ''}`;
}

