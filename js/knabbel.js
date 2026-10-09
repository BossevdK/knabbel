/* Knabbel himself: tap lines, eating along, the drawing, hunger and mood. */
const POKE = {
  any: ["Hihi, dat kietelt!", "Nog een keer!", "*knabbel knabbel*", "Heb jij ook zin in bamboe?", "Jij bent mijn favoriete mens.",
    "Wist je dat rode panda's 13 uur per dag eten?", "Pas op, ik ben kietelig!", "Achter mijn oortjes is het lekkerst.", "Prrrr… o wacht, dat doen katten.",
    "Rode panda's slapen het liefst hoog in een boom.", "Mijn staart is mijn dekentje als het koud is.", "Ik heb een extra 'duim' om bamboe vast te houden!",
    "Weet je wat ik het liefst eet? Alles. Maar vooral bamboe.", "Samen komen we er wel!", "Jij doet het echt goed, hoor.", "Boe! Schrok je?",
    "Ik oefen mijn schattigste blik. Werkt het?", "Rode panda's zijn ouder dan reuzenpanda's. Ik was er eerst!", "Kriebel kriebel!",
    "Als ik groot ben word ik… nog steeds klein.", "Zullen we even een glaasje water drinken?", "Ik vind jou echt top.", "Hé, niet aan mijn snorharen!",
    "In het wild heten we ook wel 'vuurvos'. Cool hè?", "Ik ben niet dik, ik heb gewoon veel vacht.", "Eén aai = één zaadje? Was het maar zo…",
    "Weet je wat ook gezond is? Even naar buiten.", "Ik heb vandaag al drie keer gegaapt. Dat telt als sport.", "Jouw aaien zijn de beste.", "Psst… je bent geweldig.",
    "Ik droomde vannacht van een berg bamboe.", "Heb je vandaag al iets groens gegeten?", "Wiebel wiebel!", "Ik ben er altijd voor je.",
    "Stiekem ben ik een beetje verlegen.", "Rode panda's kunnen hun staart als evenwichtsstok gebruiken.", "Even een knuffel tussendoor!", "Je laat me blozen!",
    "Ik tel mijn zaadjes graag twee keer.", "Wat een mooie dag om goed bezig te zijn!", "Ik ben klein, maar mijn hart is groot.", "Hoi! Ik zag je al aankomen.",
    "Niet vertellen, maar jij bent mijn lievelingsmens.", "Zullen we een dansje doen? *schuifel schuifel*", "Mijn oortjes gaan altijd een beetje wiebelen als ik blij ben."],
  morning: ["Goeiemorgen! Al wakker?", "Eerst ontbijt, dan de wereld.", "Gaaap… vijf minuutjes nog?", "Een goed ontbijt is het halve werk!"],
  evening: ["Gaap… nog even en dan slapen.", "Welterusten straks, slaap lekker!", "Het is al laat. Niet meer snoepen hè?", "Ik word al slaperig…"],
  hungry: ["Kriebel niet, ik heb honger!", "Mijn buik knort harder dan ik praat.", "Eten? Zei iemand eten?", "Ik zou nu wel een hapje lusten…"],
  full: ["Oef, ik zit vol, niet op mijn buik drukken!", "Zo, die zit. *boertje* Pardon!", "Ik kan geen hap meer op. Nou ja, misschien één."],
  sleepy: ["Zzz… huh? Was ik in slaap gevallen?", "Nog even liggen…", "Ik ben nog niet helemaal wakker."],
  streak: ["Wauw, al {n} dagen samen!", "{n} dagen op rij! Je vlam is prachtig.", "Met jou kan ik alles aan. Al {n} dagen!"],
  wear: {
    hkhorns: ["…", "…!", "(De Knight zegt niets. Hij knikt alleen.)"],
    d6: ["Zal ik eens rollen?", "Reroll! O nee, dat was mijn ontbijt.", "Zes ogen. Altijd zes."],
    crown: ["Buig voor uwe majesteit!", "Koninklijk aaien graag, met twee vingers."], emperor: ["De keizer is tevreden.", "Noem me voortaan Keizer Knabbel."],
    astronaut: ["Houston, ik heb trek.", "Eén kleine aai voor jou, één grote voor pandakind."],
    sadonion: ["Ik huil niet, het is de ui!", "*snik* Wat lief van je."], mantle: ["Met dit kruis kan niets me raken.", "Ik voel me heel heilig vandaag."],
    guppy: ["Ik heb nog acht levens over!", "Miauw. Wacht, ik ben een panda."], tears: ["Dit zijn vreugdetranen!"], brimstone: ["Pas op, ik schiet een laser!"], flies: ["Bzzz! Mijn vriendjes vinden je aardig."],
    triforce: ["Moed, wijsheid en… bamboe.", "Hey! Listen!"], heartcont: ["Ik heb er een hartje bij!"], hero: ["Het is gevaarlijk om alleen te gaan. Neem mij mee!"],
    pacman: ["Waka waka!", "Pac-Man eet alles. Ik ook."], ghost: ["Boe! Het spookje zegt hoi."], masterball: ["Gotta catch 'em all!", "Ik ving jou al lang geleden."],
    catchball: ["Ik kies jou!"], trainer: ["Ik word de allerbeste!"], sparkcheeks: ["Pika pika!"], thundertail: ["Bzzt! Pas op, ik ben geladen."],
    superstar: ["Onverslaanbaar!", "Tu-du-du-du-du!"], plumber: ["Het-sa me, Knabbel!", "Wahoo!"], mushroom: ["Ik word een Super Panda!"], coin: ["Ploing!"], fireflower: ["Vuurballen? Liever bamboe."],
    kirby: ["Poyo!"], crewmate: ["Ik ben niet sus, echt niet.", "Iemand moet de taken doen."], invader: ["Bliep bloep. Ik kom in vrede."],
    goldapple: ["Deze appel is van goud. Lekker? Geen idee."], torch: ["Hé, wie heeft het licht uitgedaan?"], pixsword: ["Even diamanten hakken."],
    strawberry: ["Niet opeten, deze vliegt!"], leaf: ["Er zit een blaadje op mijn hoofd. Expres."], soul: ["Je zit vol vastberadenheid."], bonfire: ["Even uitrusten bij het vuur."],
    cake: ["The cake is a lie… of toch niet?"], parsnip: ["Vers van het land!"], ring: ["Gotta go fast!"],
    wizard: ["Abracadabra… waar is mijn bamboe?"], wand: ["Hocus pocus, een gezonde focus!"], chef: ["Wat zullen we vandaag koken?"], pirate: ["Arrr! Waar is de schat? O, die zaadjes."],
    viking: ["Voor Walhalla! En voor een snackje."], halo: ["Ik ben een engeltje. Meestal."], wings: ["Ik zweef van blijdschap!"], cape: ["Super Panda schiet te hulp!"],
    phones: ["Ik luister naar mijn lievelingsliedje."], mustache: ["Zeer chique, nietwaar?"], monocle: ["Hoe interessant, zei de panda."], cowboy: ["Howdy, partner!"],
    santa: ["Hohoho! Ben je lief geweest?"], grad: ["Ik ben afgestudeerd in knuffelen."], sunflower: ["Zonnebloem? Daar komen mijn zaadjes vandaan!"], raincloud: ["Oei, mijn wolkje lekt."],
    balloon: ["Niet loslaten, anders vlieg ik weg!"], lightsaber: ["Moge de bamboe met je zijn."], scanner: ["Scan voltooid: jij bent geweldig."], vr: ["Ik zie een virtuele bamboe. Mmm."],
    jetpack: ["Klaar voor de lancering!"], dumbbell: ["Kijk mijn spierballen!"], boba: ["Slurp! Bubbels!"], dragon: ["Rawr! Ik ben een draakje."], phoenix: ["Ik ben herboren!"]
  },
  giveup: ["Oké oké, ik geef me over!", "Hahaha, stop! Ik kan niet meer!", "Genade! Ik ben te kietelig!"]
};
let pokeSeen = [], pokeTimes = [];
function pokeLine(){
  const now = Date.now(); pokeTimes = [...pokeTimes.filter(t => now - t < 6000), now];
  if (pokeTimes.length >= 10) { pokeTimes = []; return { text: POKE.giveup[Math.floor(Math.random() * POKE.giveup.length)], spin: true }; }
  const h = new Date().getHours(), mood = petMood(), w = S.meta.pet.wear || {}, n = streak();
  const ctx = [...(h >= 5 && h < 10 ? POKE.morning : []), ...(h >= 22 || h < 5 ? POKE.evening : []),
    ...(mood === 'hungry' || mood === 'starving' ? POKE.hungry : []), ...(mood === 'full' || mood === 'stuffed' ? POKE.full : []), ...(mood === 'sleepy' ? POKE.sleepy : []),
    ...(n >= 7 ? POKE.streak.map(x => x.replace('{n}', n)) : []), ...Object.values(w).flatMap(id => (id && POKE.wear[id]) || [])];
  // Something that fits the moment about half the time, otherwise one of the loose lines; never the same one again too soon.
  const pick = list => { let fresh = list.filter(x => !pokeSeen.includes(x)); if (!fresh.length) { pokeSeen = pokeSeen.filter(x => !list.includes(x)); fresh = list; }
    const t = fresh[Math.floor(Math.random() * fresh.length)]; pokeSeen = [...pokeSeen, t].slice(-60); return t; };
  return { text: pick(ctx.length && Math.random() < .5 ? ctx : POKE.any) };
}
/* Things on his head that cover his mouth: he lifts them for a moment to eat or drink, instead of eating through them. */
const COVERS_MOUTH = new Set(['hkhorns', 'astronaut']);
/* Knabbel eats or drinks along with you: a little bite (or a cup) goes to his mouth and he chews or sips. No sound.
   Only when he is on screen, and not with "reduce motion" on. */
function petEat(kind, icon){
  if (reduceMotion()) return;
  setTimeout(() => {
    const el = [...document.querySelectorAll('.pet[data-alive]')].find(p => { const r = p.getBoundingClientRect(); return r.width && r.bottom > 40 && r.top < innerHeight - 60; });
    if (!el) return;
    el.querySelectorAll('.pet-bite').forEach(x => x.remove());
    const bite = document.createElement('span');
    bite.className = 'pet-bite ' + kind; bite.appendChild(document.createElement('i')).textContent = icon || (kind === 'drink' ? '💧' : '🍽️'); bite.setAttribute('aria-hidden', 'true');
    bite.style.fontSize = Math.max(16, el.getBoundingClientRect().width * 0.22) + 'px';
    el.appendChild(bite);
    el.classList.remove('eating', 'drinking'); void el.offsetWidth; el.classList.add(kind === 'drink' ? 'drinking' : 'eating');
    setTimeout(() => { bite.remove(); el.classList.remove('eating', 'drinking'); if (FL('alive')) petDo(el, 'wiggle'); }, 1300);
  }, 250);
}
const isDrinkEntry = e => (e.items || []).length > 0 && e.items.every(i => itemMl(i) > 0);
/* Knabbel's build follows the last 7 days (today not counted, nor days marked "niet alles gelogd"), at least 3 logged:
   on average more than 8% over your eat goal gives a slightly fuller belly, on average under your minimum a slightly
   limper Knabbel (head a bit lower, ears drooping). Both are "not ideal", so eating too little is never rewarded. */
let buildMemo = null;
function petBuild(){
  if (!S.profile) return { build: 'fit', n: 0 };
  const now = Date.now(); if (buildMemo && now - buildMemo.at < 3000) return buildMemo.v;
  const ks = Array.from({ length: 7 }, (_, i) => shiftKey(todayKey(), -1 - i))
    .filter(k => day(k).entries.some(e => !e.pending) && !isPartial(k));
  let v = { build: 'fit', n: ks.length };
  if (ks.length >= 3) {
    const kcal = ks.reduce((a, k) => a + totals(k).kcal, 0) / ks.length, ratio = ks.reduce((a, k) => a + totals(k).kcal / Math.max(1, budget(k).kcal), 0) / ks.length;
    v = { build: ratio > 1.08 ? 'vol' : kcal < minKcal() * 0.97 ? 'slap' : 'fit', n: ks.length, ratio, kcal };
  }
  buildMemo = { at: now, v };
  return v;
}
let petSeq = 0;
function petSVG(mood = 'happy', wear = {}){
  const id = 'rp' + (++petSeq);
  wear = wear || {};
  // Extra groups, so the animations on body, head and ears keep working on top of the build.
  const bd = petBuild().build, limp = bd === 'slap';
  const bodyT = bd === 'vol' ? 'translate(100 188) scale(1.06 1) translate(-100 -188)' : limp ? 'translate(100 188) scale(.96 1) translate(-100 -188)' : '';
  const bellyT = bd === 'vol' ? 'translate(100 188) scale(1.16 1.05) translate(-100 -188)' : '';
  const headT = limp ? 'translate(0 3)' : '';
  const g = (t, inner) => t ? `<g transform="${t}">${inner}</g>` : inner;
  const eyes = mood === 'sleepy'
    ? '<path d="M70 94 Q78 100 86 94 M114 94 Q122 100 130 94" stroke="var(--pet-ink)" stroke-width="4" fill="none" stroke-linecap="round"/>'
    : mood === 'full'
    ? '<path d="M70 95 Q78 86 86 95 M114 95 Q122 86 130 95" stroke="var(--pet-ink)" stroke-width="4" fill="none" stroke-linecap="round"/>'
    : (mood === 'starving' ? '<path d="M66 83 Q76 80 86 76 M134 83 Q124 80 114 76" stroke="var(--pet-ink)" stroke-width="3.5" fill="none" stroke-linecap="round"/>' : '') + '<ellipse cx="78" cy="92" rx="7.5" ry="8.5" fill="var(--pet-ink)"/><ellipse cx="122" cy="92" rx="7.5" ry="8.5" fill="var(--pet-ink)"/><circle cx="81" cy="88.5" r="2.8" fill="#fff"/><circle cx="125" cy="88.5" r="2.8" fill="#fff"/><circle cx="75.5" cy="95" r="1.2" fill="#fff" opacity=".7"/><circle cx="119.5" cy="95" r="1.2" fill="#fff" opacity=".7"/>';
  const blushR = mood === 'stuffed' ? 13 : mood === 'full' ? 10 : 8;
  const mouth = {
    starving: '<path d="M100 114 V117" stroke="var(--pet-ink)" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="100" cy="124" rx="6" ry="5" fill="var(--pet-ink)"/><ellipse cx="100" cy="126" rx="3.5" ry="2" fill="#E77A86"/><path d="M110 122 q5 8 0 12 q-5 -4 0 -12" fill="#7EC3F0"/>',
    full: '<path d="M100 114 V118 M89 118 Q95 128 100 119 Q105 128 111 118" stroke="var(--pet-ink)" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M95 121 Q100 130 105 121 Z" fill="#E77A86"/>',
    happy: '<path d="M100 114 V118 M91 118 Q95.5 125 100 118 Q104.5 125 109 118" stroke="var(--pet-ink)" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M96 121 Q100 128 104 121 Z" fill="#E77A86"/>',
    hungry: '<path d="M100 114 V118 M92 126 Q100 118 108 126" stroke="var(--pet-ink)" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M108 124 q4 7 0 11 q-4 -4 0 -11" fill="#7EC3F0"/>',
    stuffed: '<path d="M100 114 V118 M93 121 H107" stroke="var(--pet-ink)" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    sleepy: '<path d="M100 114 V117" stroke="var(--pet-ink)" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="100" cy="122" rx="3.5" ry="4" fill="var(--pet-ink)"/><g class="zz"><text x="146" y="46" font-family="sans-serif" font-weight="800" font-size="18" fill="var(--muted)">z</text><text x="160" y="32" font-family="sans-serif" font-weight="800" font-size="13" fill="var(--muted)">z</text></g>'
  }[mood] || '';
  const tail = 'M128 170 C150 178 178 170 186 148 C192 130 186 112 172 104 C168 102 162 104 164 110 C172 128 166 148 148 154 C140 157 132 158 126 158 Z';
  return `<svg viewBox="0 0 200 200" role="img" aria-label="Rode panda ${esc(S.meta.pet.name)}">
    <defs><clipPath id="${id}t"><path d="${tail}"/></clipPath></defs>
    <ellipse cx="100" cy="192" rx="62" ry="6" fill="var(--pet-ink)" opacity=".12"/>
    ${wear.back ? acc(wear.back) : ''}
    ${wear.back === 'thundertail' ? '' : `<g class="tail"><path d="${tail}" fill="var(--fur)"/>
    <g clip-path="url(#${id}t)" stroke="var(--ring)" stroke-width="10" fill="none"><path d="M150 176 L154 150"/><path d="M170 168 L166 144"/><path d="M190 146 L170 136"/><path d="M188 118 L168 122"/><path d="M178 100 L164 112" stroke-width="12"/></g></g>`}
    ${g(bodyT, `<path d="M62 126 C52 148 54 174 70 188 H130 C146 174 148 148 138 126 Z" fill="var(--fur)"/>
    ${g(bellyT, '<path d="M80 134 C72 152 74 172 84 186 H116 C126 172 128 152 120 134 Z" fill="var(--dark)"/>')}`)}
    <ellipse cx="78" cy="189" rx="16" ry="7.5" fill="var(--dark)"/><ellipse cx="122" cy="189" rx="16" ry="7.5" fill="var(--dark)"/>
    ${wear.back === 'cape' ? acc('cape-front') : ''}
    ${headT ? `<g transform="${headT}">` : ''}<g class="head">${g(limp ? 'rotate(-9 64 64)' : '', '<g class="ear l"><path d="M46 72 C34 54 36 36 50 26 C62 28 74 40 78 52 Z" fill="var(--cream)"/><path d="M52 64 C44 52 46 40 53 34 C60 37 67 44 70 52 Z" fill="var(--dark)"/></g>')}
    ${g(limp ? 'rotate(9 136 64)' : '', '<g class="ear r"><path d="M154 72 C166 54 164 36 150 26 C138 28 126 40 122 52 Z" fill="var(--cream)"/><path d="M148 64 C156 52 154 40 147 34 C140 37 133 44 130 52 Z" fill="var(--dark)"/></g>')}
    <path d="M100 42 C128 42 150 54 158 74 C162 84 166 92 172 100 C165 102 161 105 164 110 C157 112 153 116 155 122 C141 132 121 137 100 137 C79 137 59 132 45 122 C47 116 43 112 36 110 C39 105 35 102 28 100 C34 92 38 84 42 74 C50 54 72 42 100 42 Z" fill="var(--fur2)"/>
    <path d="M56 96 C62 88 71 95 71 106 C71 117 60 123 49 118 C45 110 49 100 56 96 Z" fill="var(--cream)"/>
    <path d="M144 96 C138 88 129 95 129 106 C129 117 140 123 151 118 C155 110 151 100 144 96 Z" fill="var(--cream)"/>
    <ellipse cx="80" cy="75" rx="9" ry="5.5" fill="var(--cream)" transform="rotate(-12 80 75)"/><ellipse cx="120" cy="75" rx="9" ry="5.5" fill="var(--cream)" transform="rotate(12 120 75)"/>
    <ellipse cx="100" cy="117" rx="24" ry="17" fill="var(--cream)"/>
    <path d="M72 97 C74 108 80 117 87 126 L81 128 C74 120 69 109 68 99 Z" fill="var(--tear)"/>
    <path d="M128 97 C126 108 120 117 113 126 L119 128 C126 120 131 109 132 99 Z" fill="var(--tear)"/>
    <g class="blush"><ellipse cx="64" cy="112" rx="${blushR}" ry="${blushR * .6}" fill="var(--pink)" opacity=".55"/><ellipse cx="136" cy="112" rx="${blushR}" ry="${blushR * .6}" fill="var(--pink)" opacity=".55"/></g>
    <g class="eyes"><g class="follow"><g class="pupils">${eyes}</g></g></g>
    <g class="nose"><path d="M91 106 Q100 101 109 106 Q105 114 100 114 Q95 114 91 106 Z" fill="var(--pet-ink)"/><ellipse cx="97" cy="106" rx="2.5" ry="1.4" fill="#fff" opacity=".4"/></g>
    <g class="mouth">${mouth}</g></g>${headT ? '</g>' : ''}
    <g class="arm-l"><path d="M64 134 C52 146 52 164 64 170 C74 172 80 162 78 148 Z" fill="var(--dark)"/></g>
    <g class="arm-r"><path d="M136 134 C148 146 148 164 136 170 C126 172 120 162 122 148 Z" fill="var(--dark)"/></g>
    ${wear.hand ? `<g class="handacc">${acc(wear.hand)}</g>` : ''}
    ${wear.neck ? acc(wear.neck) : ''}${wear.face || wear.head ? g(headT, `<g class="head">${wear.face ? acc(wear.face) : ''}${wear.head ? `<g class="headacc${COVERS_MOUTH.has(wear.head) ? ' cover' : ''}">${acc(wear.head)}</g>` : ''}</g>`) : ''}
    ${wear.buddy ? acc(wear.buddy) : ''}
  </svg>`;
}
/* People eat in meals, not in an even line through the day. So Knabbel looks at your meals: a meal only counts as
   "late" once it is well past its usual time and still not logged (a real meal, 200 kcal or more). Meals that fell
   inside a fast don't count: skipping breakfast while fasting is the plan, not a miss. */
const MEAL_LATE = { ontbijt: 10.5, lunch: 14.5, diner: 20 };
function missedMeals(k = todayKey()){
  if (k !== todayKey()) return [];
  const now = new Date(), h = now.getHours() + now.getMinutes() / 60, F = S.meta.fast;
  const at = m => { const d = new Date(now); d.setHours(Math.floor(MEAL_LATE[m]), (MEAL_LATE[m] % 1) * 60, 0, 0); return d.getTime(); };
  const fasted = m => (F.start && F.start <= at(m)) || (F.log || []).some(x => x.end >= at(m) && x.end - x.h * 3.6e6 <= at(m));
  // A later meal already logged (lunch without breakfast): that earlier meal was skipped, not forgotten.
  const ORDER = ['ontbijt', 'lunch', 'diner'], later = m => ORDER.slice(ORDER.indexOf(m) + 1).some(x => mealDone(k, x));
  return ORDER.filter(m => h >= MEAL_LATE[m] && !mealDone(k, m) && !fasted(m) && !later(m));
}
/* Where you would be about now ("rond deze tijd" in the ring and on the belly): the meals that are eaten or overdue,
   each with what you usually eat at it. It jumps per meal instead of creeping up all day. */
function expectedByNow(){
  const k = todayKey(), h = new Date().getHours() + new Date().getMinutes() / 60, B = budget(k);
  if (h >= 21.5) return 1;
  const share = m => Math.min(0.5, (usualMealKcal(m) ?? B.base * MEAL_SHARE[m]) / B.kcal);
  return Math.min(1, ['ontbijt', 'lunch', 'diner'].filter(m => mealDone(k, m) || h >= MEAL_LATE[m]).reduce((a, m) => a + share(m), 0));
}
/* Knabbel's belly: how much of your eat goal you have eaten, compared with what fits the time of day. */
const HUNGER = {
  sleepy:   ['Slaapt nog', '😴', 'var(--muted)'],
  starving: ['Rammelt van de honger', '😫', 'var(--bad)'],
  hungry:   ['Heeft trek', '😋', 'var(--warn)'],
  happy:    ['Tevreden', '😊', 'var(--leaf)'],
  full:     ['Lekker vol', '🥰', 'var(--leaf)'],
  stuffed:  ['Propvol', '😵', 'var(--warn)']
};
function hunger(k = todayKey()){
  const t = totals(k), target = budget(k).kcal, frac = target ? t.kcal / target : 0, h = new Date().getHours();
  let state;
  if (!day(k).entries.length && k === todayKey() && h < 9) state = 'sleepy';
  else if (frac > 1.1) state = 'stuffed';
  else if (frac >= 0.9) state = 'full';
  else if (k === todayKey()) {
    // Today: only a meal that is well overdue gives hunger; two of them, or very little late in the evening, a rumbling belly.
    const missed = missedMeals(k);
    state = missed.length >= 2 || (h >= 21 && t.kcal < minKcal() * 0.7) ? 'starving' : missed.length ? 'hungry' : 'happy';
  } else {
    const behind = 1 - frac;
    state = behind > 0.35 ? 'starving' : behind > 0.12 ? 'hungry' : 'happy';
  }
  const [label, emoji, col] = HUNGER[state];
  return { state, label, emoji, col, frac, missed: k === todayKey() ? missedMeals(k) : [] };
}
const petMood = (k = todayKey()) => hunger(k).state;
/* About the last main meal you logged: 25 to 40 g protein per meal keeps your muscles best, better than all of it
   in one go. Only for a real meal (250 kcal or more), and only while it is the latest thing you logged. */
function mealProtein(k){
  const es = day(k).entries.filter(e => !e.pending), last = es[es.length - 1];
  if (!last || !['ontbijt', 'lunch', 'diner'].includes(last.meal)) return '';
  const meal = es.filter(e => e.meal === last.meal), kcal = meal.reduce((a, e) => a + e.kcal, 0), p = r0(meal.reduce((a, e) => a + (e.p || 0), 0));
  if (kcal < 250) return '';
  const name = (MEALS.find(m => m[0] === last.meal) || [0, 'maaltijd'])[1].toLowerCase();
  if (p < 20) return `Je ${name} had maar ${p} g eiwit. Doe er de volgende keer kwark, een ei of kip bij, dan blijf je langer vol.`;
  if (p >= 25) return `${p} g eiwit bij je ${name}, goed zo! Zo blijven je spieren sterk.`;
  return '';
}
/* Last night's sleep in minutes (from Health Connect), or 0 when unknown. */
const sleepLast = () => (day(todayKey()).move || {}).sleep || 0;
const hmin = m => `${Math.floor(m / 60)}u${String(Math.round(m % 60)).padStart(2, '0')}`;
function petLine(mood){
  const k = todayKey(), t = totals(k), b = budget(k), left = b.kcal - t.kcal, pr = S.profile.targets.p - t.p;
  if (mood === 'sleepy') return 'Goeiemorgen… ik ben nog wakker aan het worden. Wat gaan we ontbijten?';
  const sl = sleepLast();
  if (sl > 0 && sl < 360 && new Date().getHours() < 14) return `Je sliep maar ${hmin(sl)}. Meer trek vandaag is normaal: kies iets met eiwit, dan blijf je langer vol.`;
  const missed = missedMeals(k).map(MEAL_NAME);
  if (mood === 'starving') return missed.length >= 2 ? `Mijn buikje rammelt! We hebben ons ${andList(missed)} nog niet gehad. Zullen we iets goeds eten?` : t.kcal ? `Mijn buikje rammelt! We zitten nog ver onder je minimum van ${minKcal()} kcal.` : 'Mijn buikje rammelt! Log je eerste hapje van vandaag.';
  if (mood === 'hungry') return `Ik heb wel trek, we hebben nog geen ${missed[0] || 'maaltijd'} gehad.${pr > 30 ? ` Nog ${r0(pr)} g eiwit te gaan.` : ''} Of heb je het nog niet gelogd?`;
  if (mood === 'full') return 'Mmm, lekker vol. Precies goed zo!';
  if (mood === 'stuffed') return `Een beetje boven je doel vandaag. Geeft niks, morgen is een nieuwe dag!`;
  if (S.meta.weights.some(w => w.date === k)) { const fl = forecastLine(); if (fl) return fl; }
  const pm = mealProtein(k); if (pm) return pm;
  if (left < 150) return 'Precies raak vandaag. Ik ben trots op je!';
  if (b.bonus > 50) return `Door je beweging mag je vandaag ${b.bonus} kcal extra eten. Lekker!`;
  if (pr > 30) return `Nog ${r0(pr)} g eiwit te gaan. Zin in een idee?`;
  if (dateOf(k).getDate() % 2 === 0) { const fl = forecastLine(); if (fl) return fl; }
  return 'Lekker bezig! Zin in een idee voor straks?';
}
/* Knabbel's energy today, from four things, each measured against what fits the time of day:
   within your eat goal → energiek, enough protein → sterk, enough water → fris, movement → actief (only with a move
   goal and movement data, otherwise it would always look empty). Early in the day, before anything is expected, a
   part is simply full. */
function energy(k = todayKey()){
  const t = totals(k), Bk = budget(k).kcal, exp = expectedByNow(), h = new Date().getHours() + new Date().getMinutes() / 60;
  const dayF = clamp((h - 7) / 14, 0, 1), sofar = (have, goal, f) => f < 0.05 ? 1 : clamp(have / (goal * Math.max(f, 0.15)), 0, 1);
  const frac = Bk ? t.kcal / Bk : 0, parts = [];
  // What you'd roughly have eaten by now (by your usual meals and the time), so "Energiek" says what it measures.
  const byNow = Math.round(Bk * exp / 10) * 10;
  parts.push({ id: 'kcal', icon: '⚡', label: 'Energiek', sub: 'genoeg gegeten voor nu', v: frac > 1 ? clamp(1 - (frac - 1) * 4, 0.2, 1) : sofar(frac, 0.85, exp),
    hint: frac > 1 ? `${r0(t.kcal - Bk)} kcal boven je doel` : exp < 0.05 ? 'De dag begint nog' : `${r0(t.kcal).toLocaleString('nl-NL')} van ± ${byNow.toLocaleString('nl-NL')} kcal` });
  const pg = macroGoals(k).p;
  parts.push({ id: 'p', icon: '💪', label: 'Sterk', sub: 'eiwit', v: sofar(t.p, pg, exp), hint: t.p >= pg ? 'Eiwitdoel gehaald' : `Nog ${r0(pg - t.p)} g eiwit` });
  const wg = waterGoal(k), w = fluidMl(k);   // like the Vocht tile: coffee, tea and milk count too
  parts.push({ id: 'water', icon: '💧', label: 'Fris', sub: 'drinken', v: sofar(w, wg, dayF), hint: w >= wg ? 'Genoeg gedronken' : `Nog ${wg - w} ml` });
  const mg = S.profile.moveGoal || 0;
  if (mg > 0 && (moveOn() || (day(k).workouts || []).length)) {
    const mk = moveKcal(k);
    parts.push({ id: 'move', icon: '🏃', label: 'Actief', sub: 'bewegen', v: sofar(mk, mg, dayF), hint: mk >= mg ? 'Beweegdoel gehaald' : `Nog ${r0(mg - mk)} kcal bewegen` });
  }
  const v = parts.reduce((a, x) => a + x.v, 0) / parts.length;
  return { v, parts, label: v >= 0.8 ? 'Vol energie' : v >= 0.5 ? 'Gaat prima' : 'Kan wel wat gebruiken' };
}
const energyCol = v => v >= 0.8 ? 'var(--leaf)' : v >= 0.5 ? 'var(--c)' : 'var(--warn)';
function energyHTML(){
  const E = energy(), pct = r0(E.v * 100), P = petBuild(), name = esc(S.meta.pet.name);
  const look = P.n < 3 ? '' : P.build === 'vol' ? `${name} heeft een wat voller buikje: de afgelopen week at je gemiddeld ${r0(P.ratio * 100)}% van je eetdoel.`
    : P.build === 'slap' ? `${name} is iets slapper: de afgelopen week at je gemiddeld onder je minimum van ${minKcal()} kcal.`
    : `${name} ziet er fit uit: de afgelopen week zat je gemiddeld goed rond je eetdoel.`;
  // Each part as a small tile (like Vocht and Beweging on Vandaag): what it is, what it measures, a bar and a short value.
  // What the whole card means sits behind the i, so the card itself stays calm.
  return `<section class="card energy">
    <div class="row between"><h3>Energie</h3><span class="pill ${E.v >= 0.8 ? 'good' : E.v >= 0.5 ? 'off' : 'warn'} num">${E.label} · ${pct}%</span></div>
    <div class="egrid">${E.parts.map(x => `<div class="etile"><span class="eh"><span class="eic" aria-hidden="true">${x.icon}</span><b>${x.label}</b></span><span class="note">${x.sub}</span>
      <div class="bar thin"><i style="width:${r0(x.v * 100)}%;background:${energyCol(x.v)}"></i></div><span class="note num">${esc(x.hint)}</span></div>`).join('')}</div>
    ${look ? `<p class="note">${look}</p>` : ''}
    <details class="infox"><summary><i aria-hidden="true">i</i>Wat is dit?</summary><p class="note">Hoe ${name} zich voelt door wat je tot nu toe vandaag deed: op tijd genoeg eten, eiwit, drinken${E.parts.some(x => x.id === 'move') ? ' en bewegen' : ''}. Elk onderdeel kijkt naar hoe ver de dag is, dus 's ochtends hoeft nog niet alles vol.</p></details>
  </section>`;
}
const level = xp => Math.floor(Math.sqrt(xp / 25)) + 1;
const xpFor = l => 25 * (l - 1) ** 2;
