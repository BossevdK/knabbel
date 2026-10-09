/* The Knabbel page and the seed history. */
/* ---------- pet page ---------- */
/* The Knabbel page in tabs from left to right: the panda, badges, and the wardrobe (with a tab per body part). */
let petTab = 'panda', shopSlot = 'head';
function petHTML(){
  const P = S.meta.pet, lv = level(P.xp), from = xpFor(lv), to = xpFor(lv + 1), mood = petMood();
  const earned = Object.keys(S.meta.badges || {}).length;
  const tabs = [['panda', 'Panda'], ['badges', `Badges ${earned}/${BADGES.length}`], ['shop', 'Kledingkast']];
  const bar = `<div class="seg pettabs" role="tablist" aria-label="Onderdelen">${tabs.map(([id, l]) => `<button role="tab" data-pettab="${id}" aria-pressed="${petTab === id}" aria-selected="${petTab === id}">${l}</button>`).join('')}</div>`;
  const head = `<div class="top"><h1>${esc(P.name)}</h1><button class="seedpill num" data-act="seed-history" aria-label="${P.seeds} zaadjes, geschiedenis">🌻 ${P.seeds} zaadjes</button></div>${bar}`;
  if (petTab === 'badges') return head + badgesHTML();
  if (petTab === 'shop') return head + shopHTML();
  return `${head}
  <section class="card" style="align-items:center;text-align:center">
    <button class="pet big m-${mood}" data-alive data-act="pet-poke" style="width:200px" aria-label="Aai ${esc(P.name)}">${petSVG(mood, P.wear)}</button>
    <p class="bubble" id="petBubble">${esc(petLine(mood))}</p>
    <button class="xp-row" data-act="explain-xp" aria-label="Uitleg over level en xp"><span class="row between" style="width:100%"><span class="eyebrow">Level ${lv}</span><span class="note num">${P.xp - from} / ${to - from} xp <i aria-hidden="true">i</i></span></span></button>
    <div style="width:100%;margin-top:-6px">
    <div class="bar"><i style="width:${clamp((P.xp - from) / (to - from) * 100, 0, 100)}%;background:var(--accent)"></i></div></div>
  </section>
  ${energyHTML()}
  <section class="card"><h3>Wat draagt ${esc(P.name)}?</h3>
    ${SLOTS.some(([slot]) => P.wear[slot]) ? `<div class="wearchips">${SLOTS.map(([slot]) => { const it = SHOP.find(i => i.id === P.wear[slot]); return it ? `<button class="chip" data-shop="${it.id}" aria-label="${esc(it.name)} uittrekken">${esc(it.name)} <span aria-hidden="true" style="margin-left:6px;opacity:.6">×</span></button>` : ''; }).join('')}</div><p class="note">Tik om iets uit te trekken.</p>` : '<button class="linkline" data-pettab="shop"><span>Nog niets aan. Kijk in de kledingkast</span><span class="chev" aria-hidden="true">›</span></button>'}</section>`;
}
/* What the challenges look at: the badge numbers plus a few more, all from your own data. */
const FRUIT_RE = /\b(appel|peer|peren|banaan|bananen|sinaasappel|mandarijn|kiwi|aardbei|framboz|bosbes|blauwe bes|bessen|druif|druiven|mango|ananas|meloen|perzik|nectarine|pruim|kers|granaatappel|fruit)/i;
const VEG_RE = /(groente|\bsla\b|tomaat|tomaten|komkommer|paprika|wortel|broccoli|bloemkool|spinazie|boerenkool|courgette|aubergine|\bui\b|uien|prei|champignon|sperzieboon|boontjes|doperwt|andijvie|spruitjes|rode kool|witlof|biet|radijs|asperge|rucola|snijbonen)/i;
function questStats(){
  const st = badgeStats(), ks = Object.keys(S.days).filter(k => (S.days[k].entries || []).some(e => !e.pending)).sort();
  const es = ks.flatMap(k => S.days[k].entries.filter(e => !e.pending));
  const has = re => e => re.test(e.name || '') || (e.items || []).some(i => re.test(i.name || ''));
  let comebacks = 0, goalRun = 0, run = 0, prev = null;
  ks.forEach(k => { if (prev && shiftKey(prev, 4) <= k) comebacks++; prev = k; });
  Object.keys(S.days).sort().forEach((k, i, arr) => { run = S.days[k].flags?.goal ? (i && shiftKey(arr[i - 1], 1) === k && S.days[arr[i - 1]].flags?.goal ? run + 1 : 1) : 0; goalRun = Math.max(goalRun, run); });
  const fastDay = k => (S.meta.fast.log || []).some(x => x.h >= x.goal && keyOf(new Date(x.end)) === k);
  return { ...st, comebacks, goalRun, logDays: ks.length, badges: Object.keys(S.meta.badges || {}).length,
    ideaRolls: S.meta.ideaRolls || 0, fitAsks: S.meta.fitAsks || 0, score10: st.score10 ? 1 : 0, lost: Math.max(0, Math.floor((st.lost || 0) * 10) / 10),
    triDays: ks.filter(k => { const f = S.days[k].flags || {}; return f.goal && f.water && (f.move || fastDay(k)); }).length,
    fullDays4: ks.filter(k => ['ontbijt', 'lunch', 'diner', 'snack'].every(m => S.days[k].entries.some(e => e.meal === m && !e.pending))).length,
    steps10k: ks.filter(k => (S.days[k].move?.steps || 0) >= 10000).length, sleep7: ks.filter(k => (S.days[k].move?.sleep || 0) >= 420).length,
    fruit: es.filter(has(FRUIT_RE)).length, veg: es.filter(has(VEG_RE)).length };
}
function shopHTML(){
  const P = S.meta.pet, QS = SHOP.some(i => i.quest && i.slot === shopSlot) ? questStats() : {};
  return `
  <div class="shopsticky">${shopSlotsHTML(P)}
  <div class="shoppreview" id="shop"><span class="pet alive" aria-hidden="true">${petSVG('happy', P.wear)}</span><span class="grow"><b>Zo ziet ${esc(P.name)} eruit</b><br><span class="note">Tik om te kopen, aan of uit te trekken.</span></span></div></div>
  ${SLOTS.filter(([slot]) => slot === shopSlot).map(([slot, label]) => `<section class="card"><h3>${label}</h3><div class="shop">
    ${SHOP.filter(i => i.slot === slot).map(i => shopItemHTML(i, P, QS)).join('')}
  </div></section>`).join('')}`;
}
/* One item in the wardrobe. The drawing of Knabbel with that item is made once and remembered (it doesn't change),
   and the last HTML of every item is kept, so a tap only redraws the items that really changed (see refreshShop). */
const shopLast = new Map(), shopSvgMemo = new Map();
function shopPetSVG(i){
  const k = `${i.slot}:${i.id}:${petBuild().build}:${S.meta.pet.name}`;
  let svg = shopSvgMemo.get(k); if (!svg) shopSvgMemo.set(k, svg = petSVG('happy', { [i.slot]: i.id }));
  return svg;
}
/* How an earned item was won, also after you own it. */
const earnedText = i => i.quest ? `Verdiend met: ${i.quest[2]}` : `Vrijgespeeld op level ${i.level}.`;
function shopSlotsHTML(P){
  return `<div class="seg shopslots" role="tablist" aria-label="Soort kleding">${SLOTS.map(([slot, label]) => { const n = SHOP.filter(i => i.slot === slot && P.owned.includes(i.id)).length, all = SHOP.filter(i => i.slot === slot).length;
    return `<button role="tab" data-shopslot="${slot}" aria-pressed="${shopSlot === slot}" aria-label="${label}, ${n} van ${all} gekocht">${slot === 'hand' ? 'Poot' : label}<span class="num">${n}/${all}</span></button>`; }).join('')}</div>`;
}
function shopItemHTML(i, P, QS){
  const slot = i.slot;
  const own = P.owned.includes(i.id), on = P.wear[slot] === i.id;
      const lvOk = (!i.level || level(P.xp) >= i.level) && QUEST_DONE(i, QS), can = own || (lvOk && P.seeds >= i.price);
      const q = i.quest, qHave = q ? Math.min(QS[q[0]] || 0, q[1]) : 0;
      const tag = on ? '<span class="price on">✓ Draag je</span>' : own ? '<span class="price own">Aantrekken</span>'
        : q && !lvOk ? `<span class="price quest">🎯 ${String(qHave).replace('.', ',')}/${q[1]}</span>`
        : q ? '<span class="price buy">🎁 Gratis</span>'
        : i.level && !lvOk ? (i.price ? `<span class="price two">🔒 Level ${i.level}<small>daarna 🌻 ${i.price}</small></span>` : `<span class="price">🔒 Level ${i.level}</span>`)
        : i.level && !i.price ? '<span class="price buy">🎁 Gratis</span>'
        : can ? `<span class="price buy">🌻 ${i.price}</span>` : `<span class="price">🔒 ${i.price}</span>`;
      const html = `<button data-shop="${i.id}" aria-pressed="${on}" class="${can ? '' : 'locked'}${i.level && !i.price ? ' lvitem' : ''}${q ? ' questitem' : ''}" aria-label="${esc(i.name)}${i.game ? ' uit ' + i.game : ''}: ${on ? 'draag je nu, tik om uit te doen' + (q || i.level ? '. ' + earnedText(i) : '') : own ? 'van jou, tik om aan te trekken' + (q || i.level ? '. ' + earnedText(i) : '') : q && !lvOk ? 'uitdaging: ' + q[2] + ' Nu ' + qHave + ' van ' + q[1] : q ? 'uitdaging gehaald, tik om te pakken' : i.level && !lvOk ? 'komt vrij op level ' + i.level + (i.price ? ', daarna voor ' + i.price + ' zaadjes' : '') : i.level && !i.price ? 'gratis, tik om te pakken' : can ? 'kopen voor ' + i.price + ' zaadjes' : 'nog ' + (i.price - P.seeds) + ' zaadjes nodig'}">${shopPetSVG(i)}${own && (q || i.level) ? `<span class="earned" data-earned="${i.id}" title="Hoe verdiend?" aria-hidden="true">🏅</span>` : ''}<span>${i.name}</span>${i.game ? `<span class="game">🎮 ${i.game === 'The Binding of Isaac' ? 'Isaac' : i.game}</span>` : ''}${tag}</button>`;
  shopLast.set(i.id, html);
  return html;
}
/* After buying, putting on or taking off: the same page, with only the changed items, the preview, the counts and
   your seeds redrawn (drawing all ±2300 parts again made every tap slow on a phone). */
function refreshShop(){
  if (view !== 'pet' || petTab !== 'shop' || !document.querySelector('.shopsticky')) { render(); return; }
  const P = S.meta.pet, QS = SHOP.some(i => i.quest && i.slot === shopSlot) ? questStats() : {};
  document.querySelectorAll('.shop button[data-shop]').forEach(b => {
    const it = SHOP.find(i => i.id === b.dataset.shop); if (!it) return;
    const before = shopLast.get(it.id), html = shopItemHTML(it, P, QS);
    if (html !== before) b.outerHTML = html;
  });
  const pv = document.querySelector('.shoppreview .pet'); if (pv) pv.innerHTML = petSVG('happy', P.wear);
  const ss = document.querySelector('.shopslots'); if (ss) ss.outerHTML = shopSlotsHTML(P);
  document.querySelectorAll('.seedpill').forEach(el => { el.textContent = `🌻 ${P.seeds} zaadjes`; el.setAttribute('aria-label', `${P.seeds} zaadjes, geschiedenis`); });
  wakePets();
}

/* ---------- seed history ---------- */
function seedHistoryHTML(){
  const P = S.meta.pet, log = [...(S.meta.seedLog || [])].reverse(), days = new Map();
  log.forEach(x => { const k = keyOf(new Date(x.t)); if (!days.has(k)) days.set(k, []); days.get(k).push(x); });
  const dayName = k => k === todayKey() ? 'Vandaag' : k === shiftKey(todayKey(), -1) ? 'Gisteren' : shortDate(k);
  const first = (S.meta.seedLog || [])[0];
  return `<div class="seedhead"><span class="num">🌻 ${P.seeds}</span><span class="note">zaadjes om te besteden</span></div>
    ${log.length ? [...days.entries()].map(([k, xs]) => `<div class="seedday"><span class="eyebrow">${dayName(k)}</span>
      ${xs.map(x => `<div class="row between seedrow"><span class="grow">${esc(x.why || (x.n > 0 ? 'Verdiend' : 'Uitgegeven'))}</span><b class="num ${x.n > 0 ? 'plus' : 'min'}">${x.n > 0 ? '+' : '−'}${Math.abs(x.n)}</b></div>`).join('')}</div>`).join('')
      : '<p class="muted">Nog niets bijgehouden. Log iets of haal een doel, dan zie je hier waar je zaadjes vandaan komen.</p>'}
    <p class="note">${first ? `Bijgehouden sinds ${shortDate(keyOf(new Date(first.t)))}. Wat je daarvoor verdiende, staat er niet in.` : ''} Zaadjes verdien je met loggen, je doelen halen, weegmomenten en badges.</p>
    <button class="btn block" data-act="goto-shop">Naar de kledingkast</button>`;
}

