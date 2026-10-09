/* Badges, XP, seeds and the streak. */
/* ---------- badges: milestones, each once, with sunflower seeds ---------- */
const BADGES = [
  ['first', '🍽️', 'Eerste hapje', 'Log je eerste maaltijd', 5, s => s.meals >= 1],
  ['streak3', '🔥', '3 dagen op rij', 'Log 3 dagen achter elkaar', 5, s => s.best >= 3],
  ['streak7', '🔥', 'Een week op rij', 'Log 7 dagen achter elkaar', 15, s => s.best >= 7],
  ['streak30', '🏆', 'Een maand op rij', 'Log 30 dagen achter elkaar', 50, s => s.best >= 30],
  ['meals50', '📒', '50 maaltijden', 'Log 50 maaltijden', 15, s => s.meals >= 50],
  ['meals250', '📚', '250 maaltijden', 'Log 250 maaltijden', 40, s => s.meals >= 250],
  ['goal7', '🎯', 'Scherpschutter', 'Haal 7 keer je eetdoel', 20, s => s.goal >= 7],
  ['water7', '💧', 'Waterrat', 'Haal 7 keer je vochtdoel', 15, s => s.water >= 7],
  ['move10', '👟', 'Beweegkampioen', 'Haal 10 keer je beweegdoel', 20, s => s.move >= 10],
  ['fast10', '⏳', 'Vastenprof', 'Haal 10 keer je vastendoel', 15, s => s.fasts >= 10],
  ['score8', '🥦', 'Voedzame dag', 'Haal een dagscore van 8 of hoger', 10, s => s.bestScore >= 8],
  ['scan', '▦', 'Scanner', 'Scan je eerste barcode', 5, s => s.scans >= 1],
  ['checkin4', '📅', 'Trouwe weger', 'Doe 4 weegmomenten', 15, s => s.checkins >= 4],
  ['ontrack4', '📈', 'Op koers', 'Zit 4 weegmomenten op schema', 25, s => s.good >= 4],
  ['kg1', '⚖️', 'Eerste kilo eraf', 'Val 1 kg af sinds je start', 15, s => s.lost >= 1],
  ['kg5', '🥈', '5 kilo eraf', 'Val 5 kg af sinds je start', 40, s => s.lost >= 5],
  ['kg10', '🥇', '10 kilo eraf', 'Val 10 kg af sinds je start', 80, s => s.lost >= 10],
  ['target', '👑', 'Streefgewicht!', 'Bereik je streefgewicht', 100, s => s.reached],
  ['fashion', '🎩', 'Modepanda', 'Koop 5 outfits', 10, s => s.owned >= 5],
  ['streak14', '🔥', 'Twee weken op rij', 'Log 14 dagen achter elkaar', 25, s => s.best >= 14],
  ['streak60', '💎', 'Twee maanden op rij', 'Log 60 dagen achter elkaar', 80, s => s.best >= 60],
  ['streak100', '🌟', 'Honderd dagen!', 'Log 100 dagen achter elkaar', 150, s => s.best >= 100],
  ['meals500', '🏛️', '500 maaltijden', 'Log 500 maaltijden', 60, s => s.meals >= 500],
  ['meals1000', '🗿', '1000 maaltijden', 'Log 1000 maaltijden', 120, s => s.meals >= 1000],
  ['goal30', '🏹', 'Meesterschutter', 'Haal 30 keer je eetdoel', 50, s => s.goal >= 30],
  ['water30', '🐳', 'Walvis', 'Haal 30 keer je vochtdoel', 40, s => s.water >= 30],
  ['move30', '🏃', 'Marathonpanda', 'Haal 30 keer je beweegdoel', 50, s => s.move >= 30],
  ['fast30', '🧘', 'Zen-meester', 'Haal 30 keer je vastendoel', 40, s => s.fasts >= 30],
  ['score8x7', '🥗', 'Groene week', 'Haal 7 keer een dagscore van 8 of hoger', 30, s => s.score8 >= 7],
  ['score10', '💯', 'Perfecte dag', 'Haal een dagscore van 10', 25, s => s.score10],
  ['scan25', '🛒', 'Superscanner', 'Scan 25 barcodes', 20, s => s.scans >= 25],
  ['photo', '📸', 'Fotograaf', 'Log een maaltijd met een foto', 5, s => s.photos >= 1],
  ['idea', '💡', 'Goed idee!', 'Eet een idee van Knabbel', 5, s => s.ideas >= 1],
  ['recipe', '📖', 'Chef-kok', 'Deel een recept naar Knabbel', 10, s => s.recipes >= 1],
  ['checkin12', '🗓️', 'Kwartaalweger', 'Doe 12 weegmomenten', 40, s => s.checkins >= 12],
  ['kg15', '🏅', '15 kilo eraf', 'Val 15 kg af sinds je start', 120, s => s.lost >= 15],
  ['kg20', '🎖️', '20 kilo eraf', 'Val 20 kg af sinds je start', 160, s => s.lost >= 20],
  ['level10', '⭐', 'Level 10', 'Bereik level 10', 30, s => s.level >= 10],
  ['level20', '🌠', 'Level 20', 'Bereik level 20', 60, s => s.level >= 20],
  ['fashion15', '👗', 'Fashionista', 'Koop 15 outfits', 30, s => s.owned >= 15],
  ['fashion40', '💃', 'Topmodel', 'Koop 40 outfits', 80, s => s.owned >= 40],
  ['legend', '🐉', 'Legendarisch', 'Koop een outfit van 300 zaadjes of meer', 40, s => s.legend]
];
function badgeStats(){
  const ks = Object.keys(S.days).filter(k => (S.days[k].entries || []).some(e => !e.pending)).sort();
  let best = 0, run = 0, prev = null;
  ks.forEach(k => { run = prev && shiftKey(prev, 1) === k ? run + 1 : 1; best = Math.max(best, run); prev = k; });
  const days = Object.values(S.days), P = S.profile, ws = weightSeries(), last = ws[ws.length - 1];
  const lost = P && P.goal === 'lose' && last && firstLogKey() ? startWeight() - last.kg : 0;
  const reached = !!(P && P.goalWeight && last && firstLogKey() && ((P.goal === 'lose' && last.kg <= P.goalWeight) || (isGain(P.goal) && last.kg >= P.goalWeight)));
  const earned = S.meta.badges || {};
  return {
    meals: days.reduce((a, d) => a + (d.entries || []).filter(e => !e.pending).length, 0), best,
    goal: days.filter(d => d.flags?.goal).length, water: days.filter(d => d.flags?.water).length, move: days.filter(d => d.flags?.move).length,
    fasts: (S.meta.fast.log || []).filter(x => x.h >= x.goal).length, scans: S.meta.scans || 0,
    ...(() => { // day scores are only worked out while a badge still needs them
      if (earned.score8 && earned.score8x7 && earned.score10) return { bestScore: 10, score8: 7, score10: true };
      const sc = ks.map(k => dayScore(k)?.score || 0);
      return { bestScore: Math.max(0, ...sc), score8: sc.filter(x => x >= 8).length, score10: sc.some(x => x >= 10) }; })(),
    photos: days.reduce((a, d) => a + (d.entries || []).filter(e => e.src === 'foto').length, 0),
    ideas: days.reduce((a, d) => a + (d.entries || []).filter(e => e.src === 'advies').length, 0),
    recipes: days.reduce((a, d) => a + (d.entries || []).filter(e => e.src === 'recept').length, 0),
    level: level(S.meta.pet.xp), legend: S.meta.pet.owned.some(id => (SHOP.find(i => i.id === id)?.price || 0) >= 300),
    checkins: S.meta.checkins.length, good: S.meta.checkins.filter(c => c.status === 'good').length,
    lost, reached, owned: S.meta.pet.owned.length
  };
}
let badgeBusy = false;
function checkBadges(){
  if (badgeBusy || !S.profile) return;
  const first = !S.meta.badges; const earned = S.meta.badges ||= {};
  const open = BADGES.filter(b => !earned[b[0]]); if (!open.length) return;
  badgeBusy = true;
  try {
    const st = badgeStats(), fresh = open.filter(b => b[5](st));
    if (!fresh.length) { if (first) save(); return; }
    fresh.forEach(b => earned[b[0]] = todayKey());
    if (first) { save(); toast(fresh.length === 1 ? `Je hebt al een badge verdiend: ${fresh[0][2]}!` : `Je hebt al ${fresh.length} badges verdiend! Bekijk ze bij ${S.meta.pet.name}.`); return; }
    const seeds = fresh.reduce((a, b) => a + b[4], 0);
    reward(seeds, 10 * fresh.length, null, fresh.length === 1 ? `Badge: ${fresh[0][2]}` : `${fresh.length} badges`);
    toast(fresh.length === 1 ? `🏅 Nieuwe badge: ${fresh[0][2]}  +${seeds} 🌻` : `🏅 ${fresh.length} nieuwe badges  +${seeds} 🌻`);
    confetti(36);
  } finally { badgeBusy = false; }
}
function badgesHTML(){
  const earned = S.meta.badges || {}, n = BADGES.filter(b => earned[b[0]]).length;
  return `<section class="card" aria-label="Badges"><div class="row between"><h3>Badges</h3><span class="note num">${n} van ${BADGES.length}</span></div>
    ${n ? '<div class="eyebrow">Behaald</div>' : ''}
    <div class="badges">${[...BADGES].sort((x, y) => !!earned[y[0]] - !!earned[x[0]]).map(([id, ic, name, how, seeds], i, arr) => (earned[id]
      ? `<div class="badge got"><span class="ic" aria-hidden="true">${ic}</span>${name}<span class="note">${shortDate(earned[id])}</span></div>`
      : `${i > 0 && earned[arr[i - 1][0]] ? '</div><div class="eyebrow">Nog te halen</div><div class="badges">' : ''}<div class="badge locked"><span class="ic" aria-hidden="true">${ic}</span>${name}<span class="note">${how} · 🌻 ${seeds}</span></div>`)).join('')}</div></section>`;
}
function xpHTML(){
  const P = S.meta.pet, lv = level(P.xp), nextItem = SHOP.filter(i => i.level > lv).sort((a, b) => a.level - b.level)[0];
  return `<p>Met <b>xp</b> groeit ${esc(P.name)} een level. Met <b>zaadjes</b> koop je outfits. Allebei verdien je met gezonde gewoontes:</p>
    <div class="card eqs"><div class="eq"><span class="muted">Waarmee</span><b class="note">zaadjes · xp</b></div>
      ${XP_SOURCES.map(([l, sd, xp]) => `<div class="eq"><span>${l}</span><b class="num">🌻 ${sd} · ${xp} xp</b></div>`).join('')}</div>
    <p>Je bent level <b>${lv}</b> met ${P.xp} xp. Level ${lv + 1} bij ${xpFor(lv + 1)} xp, nog ${xpFor(lv + 1) - P.xp} xp. Elk level vraagt iets meer xp dan het vorige.</p>
    <div class="eyebrow">Vrij te spelen op een level</div>
    <div class="card eqs">${SHOP.filter(i => i.level).sort((a, b) => a.level - b.level).map(i => `<div class="eq ${lv >= i.level ? 'plus' : ''}"><span>${lv >= i.level ? '✓' : '🔒'} ${i.name}</span><b class="num">level ${i.level}</b></div>`).join('')}</div>
    ${nextItem ? `<p class="note">Volgende: ${nextItem.name} op level ${nextItem.level}.</p>` : '<p class="note">Je hebt alles vrijgespeeld!</p>'}
    <button class="btn block ghost" data-act="goto-shop">Naar de kledingkast</button>`;
}
/* Every change in seeds is written down (the last 300), so you can see how you earned and spent them. */
function seedLog(n, why){
  if (!n) return;
  S.meta.seedLog = [...(S.meta.seedLog || []), { t: Date.now(), n, why: String(why || '').replace(/!$/, '').slice(0, 60) }].slice(-300);
}
function reward(seeds, xp, why, logWhy){
  const lvBefore = level(S.meta.pet.xp);
  S.meta.pet.seeds += seeds; S.meta.pet.xp += xp; seedLog(seeds, logWhy || why); save();
  if (why) { toast(`${why}  +${seeds} zaadjes`); confetti(); setTimeout(petDance, 300); }
  const lv = level(S.meta.pet.xp);
  if (lv > lvBefore) {
    const unlocked = SHOP.filter(i => i.level > lvBefore && i.level <= lv);
    toast(unlocked.length ? `Level ${lv}! Nieuw vrijgespeeld: ${unlocked.map(i => i.name).join(', ')} (in de kledingkast)` : `Level ${lv}! ${S.meta.pet.name} groeit.`);
    confetti(40); setTimeout(petDance, 300);
  }
}
function streak(){
  let k = todayKey(), n = 0;
  if (!day(k).entries.length) k = shiftKey(k, -1);
  while (day(k).entries.length) { n++; k = shiftKey(k, -1); }
  return n;
}

