/* Products from Open Food Facts and NEVO, search, barcode, photo and labels. */
/* ---------- products from Open Food Facts: free, no AI requests ---------- */
async function offCall(method, args, url){
  const r = Native ? await nat(method, args) : await fetch(url).then(async x => ({ status: x.status, body: await x.text() }));
  if (r.status >= 500) throw { code: 'busy' };
  let j; try { j = JSON.parse(r.body); } catch (e) { throw { code: 'invalid_json' }; }
  return j;
}
/* Product search. The app asks Android, which uses Open Food Facts' search service. A browser (the iPhone version)
   is not allowed to call that service directly, so there the older search on world.openfoodfacts.org is used;
   it is less picky, so only products whose name or brand contains one of the search words are kept. */
/* Looking a part up only needs the name, the brand and the values per 100 g: a smaller answer. */
const OFF_LEAN = 'code,product_name,product_name_nl,brands,nutriments';
const OFF_FIELDS = 'code,product_name,product_name_nl,brands,nutriments,serving_quantity,serving_size,quantity,nutriscore_grade,categories_tags';
async function offSearch(q, size, nl, lean){
  if (Native) return (await offCall('food.search', { q: nl ? `${q} countries_tags:"en:netherlands"` : q, size, ...(lean ? { fields: OFF_LEAN } : {}) })).hits || [];
  // Too many searches in a minute: the answer then lacks the browser permission and looks like no connection.
  const j = await offCall(null, null, `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${size}&fields=${lean ? OFF_LEAN : OFF_FIELDS}${nl ? '&tagtype_0=countries&tag_contains_0=contains&tag_0=netherlands' : ''}`).catch(e => { throw e && e.code ? e : { code: 'off_busy' }; });
  const want = offTokens(q);
  return (j.products || []).filter(p => { const have = offTokens(offName(p) + ' ' + (p.brands || '')); return !want.length || want.some(w => have.includes(w)); });
}
const NUTRI = { a: 9, b: 7, c: 5, d: 3, e: 2 };
const NUTRI_COL = { a: '#1E8F4E', b: '#7AC547', c: '#E8B92A', d: '#E57F2B', e: '#D93A2B' };
/* The Nutri-Score sum for food, per 100 g, when the package has no grade: points against for energy, sugar,
   saturated fat and salt, points for fibre and protein (protein only counts while the "against" points stay under 11).
   Fruit and vegetable share isn't known, so it counts as 0. The grade A-E is turned into the same 1-10 as elsewhere. */
function nutriLocal(n){
  const v = k => num(n[k]), step = (x, ths) => ths.filter(t => x > t).length;
  if (!offKcal100(n)) return null;
  const kj = v('energy-kj_100g') || offKcal100(n) * 4.184, sodium = (n['sodium_100g'] != null ? v('sodium_100g') : v('salt_100g') / 2.5) * 1000;
  const N = step(kj, [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350]) + step(v('sugars_100g'), [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45])
          + step(v('saturated-fat_100g'), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) + step(sodium, [90, 180, 270, 360, 450, 540, 630, 720, 810, 900]);
  const fib = step(v('fiber_100g'), [0.9, 1.9, 2.8, 3.7, 4.7]), prot = step(v('proteins_100g'), [1.6, 3.2, 4.8, 6.4, 8.0]);
  const pts = N - fib - (N < 11 ? prot : 0);
  return NUTRI[pts <= -1 ? 'a' : pts <= 2 ? 'b' : pts <= 10 ? 'c' : pts <= 18 ? 'd' : 'e'];
}
/* Is there an energy value at all? 0 kcal (cola zero, water) is a value; a missing one is not. */
const offHasEnergy = n => !!n && ['energy-kcal_100g', 'energy-kj_100g', 'energy_100g'].some(k => n[k] !== undefined && n[k] !== null && n[k] !== '');
function offKcal100(n){ n = n || {}; return num(n['energy-kcal_100g']) || num(n['energy-kj_100g'] || n['energy_100g']) / 4.184; }
function offName(p){
  const name = String(p.product_name_nl || p.product_name || '').trim() || 'Onbekend product';
  const brand = (Array.isArray(p.brands) ? p.brands[0] : String(p.brands || '').split(',')[0] || '').trim();
  return brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} (${brand})` : name;
}
/* A product as a result the sheet can show: per serving when the package says how big one is, else per 100 g/ml. */
/* (A product from the list in the app gets no guessed Nutri-Score: it has no sugar, salt or fibre. The AI gives a score later.) */
function productResult(p, code){
  const n = p.nutriments || {}, k100 = offKcal100(n);
  if (!offHasEnergy(n)) return null;
  const title = offName(p).slice(0, 80);
  // Sold per litre isn't enough to be a drink: vla, yoghurt and custard come in litres too. A drink category
  // (or plain milk) or a drink name counts, and never with a name that says it is something to eat with a spoon.
  const cats = p.categories_tags || [], low = title.toLowerCase();
  const drinkName = /drink|drank|melk\b|melk |shake|smoothie|sap\b|limonade|frisdrank|\bthee\b|koffie|water\b/.test(low);
  const spoon = !drinkName && (NOT_DRINK.test(low) || /yoghurt|kwark|skyr|dessert|toetje|custard|griesmeel|\bpap\b/.test(low)
    || cats.some(c => /desserts|yogurts|yoghurts|puddings|custards/.test(c)));
  const drinkCat = cats.some(c => /beverages|drinks|dranken|en:milks$|en:plain-milks|en:semi-skimmed-milks|en:skimmed-milks|en:whole-milks/.test(c));
  const liquid = !spoon && (drinkCat || (/\d\s*(ml|cl|l)\b/i.test(String(p.quantity || '')) && DRINK_RE.test(low)));
  const alcohol = num(n['alcohol_100g']) > 0.5;
  const sq = num(p.serving_quantity);
  const per = g => ({ grams: g, kcal: k100 * g / 100, p: num(n['proteins_100g']) * g / 100, c: num(n['carbohydrates_100g']) * g / 100, f: num(n['fat_100g']) * g / 100,
                      sf: n['saturated-fat_100g'] != null && n['saturated-fat_100g'] !== '' ? num(n['saturated-fat_100g']) * g / 100 : null, ml: liquid && !alcohol ? g : 0 });
  const it = sq > 0 && sq < 1500
    ? mkItem({ name: title, qty: 1, unit: 'portie', unitPl: 'porties', ...per(sq) })
    : mkItem({ name: title, qty: liquid ? 250 : 100, unit: liquid ? 'ml' : 'g', ...per(liquid ? 250 : 100) });
  const grade = String(p.nutriscore_grade || '').toLowerCase();
  const qm = String(p.quantity || '').replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(kg|g|l|cl|ml)\b/i);
  const pack = qm ? num(qm[1]) * ({ kg: 1000, g: 1, l: 1000, cl: 10, ml: 1 })[qm[2].toLowerCase()] : 0, u = liquid ? 'ml' : 'g';
  const portions = [...(sq > 0 ? [{ label: 'Standaardportie', grams: sq, unit: u }] : []), ...(pack > 0 && pack < 5000 ? [{ label: liquid ? 'Hele fles of pak' : 'Hele verpakking', grams: pack, unit: u }] : [])];
  return { title, icon: '', items: [it], mult: 1, confidence: '', score: NUTRI[grade] || (liquid || p.local ? null : nutriLocal(n)), tip: '', src: 'product', code: code || p.code || '', portions };
}
function rememberProduct(code, R){
  if (!code) return;
  const P = S.meta.products ||= {};
  P[code] = { ...R, items: R.items.map(({ base, ...i }) => i), at: Date.now() };
  const ks = Object.keys(P); if (ks.length > 200) ks.sort((a, b) => P[a].at - P[b].at).slice(0, ks.length - 200).forEach(x => delete P[x]);
}
async function scanBarcode(){
  const cur = L; if (!cur) return;
  let code;
  if (!Native) {
    let img; try { img = await webImage(true, 1600); } catch (e) { toast('De foto lukte niet. Probeer het nog eens.'); return; }
    if (!img || L !== cur) return;
    cur.busy = true; cur.busyText = 'Streepjescode lezen…'; cur.error = ''; renderSheet();
    try { code = await readBarcode(img); } catch (e) { code = null; }
    cur.busy = false; cur.busyText = '';
    if (L !== cur) return;
    if (!code) { cur.error = 'Ik kon geen streepjescode lezen op de foto. Maak hem van dichtbij, recht en scherp, of zoek het product op naam.'; cur.errCode = ''; renderSheet(); return; }
  } else try { code = await nat('barcode.scan'); } catch (e) { cur.error = 'De scanner is nog niet klaar (Google downloadt hem de eerste keer). Probeer het zo opnieuw.'; cur.errCode = ''; renderSheet(); return; }
  if (!code || L !== cur) return;
  S.meta.scans = (S.meta.scans || 0) + 1;
  const known = (S.meta.products || {})[code];
  if (known) { cur.result = { ...known, items: known.items.map(mkItem) }; save(); renderSheet(); return; }
  // In the list inside the app: instant, also without internet.
  await Promise.race([offLoad(), sleep(1200)]);
  const here = offLocalCode(code), RH = here && productResult(here, code);
  if (RH && L === cur) { cur.result = RH; rememberProduct(code, RH); save(); renderSheet(); return; }
  cur.busy = true; cur.busyText = 'Product opzoeken…'; cur.error = ''; const tok = ++cur.token; renderSheet();
  try {
    const j = await offCall('food.get', { code }, `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
    if (L !== cur || cur.token !== tok) return;
    const R = j && j.status === 1 && j.product ? productResult(j.product, code) : null;
    if (R) { cur.result = R; rememberProduct(code, R); save(); }
    else if (j && j.product) { cur.error = `Van ${offName(j.product)} staan geen voedingswaarden in de database. Maak een foto van het etiket, beschrijf het hieronder, of vul het zelf in.`; cur.text = offName(j.product); cur.scanCode = code; cur.errCode = 'label'; }
    else { cur.error = `Dit product (${code}) staat nog niet in de database. Maak een foto van het etiket, beschrijf het hieronder, of vul het zelf in.`; cur.scanCode = code; cur.errCode = 'label'; }
  } catch (e) { if (L !== cur || cur.token !== tok) return; cur.error = errCopy(e.code ? e : { code: 'network' }); cur.errCode = ''; }
  cur.busy = false; cur.busyText = ''; renderSheet();
}
async function searchProducts(){
  const cur = L; if (!cur) return;
  const q = (($('#offQ') || {}).value ?? cur.search.q).trim(); cur.search.q = q;
  if (q.length < 2) { cur.search.error = 'Typ eerst wat je zoekt, bijv. "halfvolle melk".'; renderSheet(); return; }
  cur.search.busy = true; cur.search.error = ''; cur.search.note = ''; renderSheet();
  // The list inside the app answers at once; online results come after (and only when the list gave few).
  await Promise.race([offLoad(), sleep(1200)]);
  const here = offLocalHits(offTokens(q), 20).filter(h => offHasEnergy(h.nutriments));
  if (here.length) { cur.search.results = here; if (here.length >= 8) { cur.search.busy = false; renderSheet(); return; } renderSheet(); }
  const run = async nl => (await offSearch(q, 24, nl)).filter(h => offHasEnergy(h.nutriments));
  try {
    let hits = await run(true);
    if (!hits.length) hits = await run(false);
    if (L !== cur) return;
    cur.search.results = [...here, ...hits.filter(h => !here.some(x => x.code === h.code))].slice(0, 20);
    if (!cur.search.results.length) cur.search.error = 'Niets gevonden. Probeer een ander woord, of beschrijf het voor de AI.';
  } catch (e) { if (L !== cur) return; if (here.length) cur.search.note = 'Alleen producten uit de lijst in de app: online lukte het nu niet.'; else cur.search.error = errCopy(e.code ? e : { code: 'network' }); }
  cur.search.busy = false; renderSheet();
}

/* Practical measures: how people say how much they ate. NEVO only gives values per 100 g, so these are Knabbel's own,
   based on the usual Dutch portions (Voedingscentrum). Matched on the product name, the first fitting rule wins;
   every product also gets grams (or ml) as the last choice. [unit, plural, grams] */
const MEASURES = [
  [/^(krentenbrood|rozijnenbrood|suikerbrood|ontbijtkoek)/, [['plak', 'plakken', 30]]],
  [/broodje|bolletje|pistolet|kaiser|krentenbol|croissant|afbakbrood/, [['stuk', 'stuks', 55]]],
  [/(brood|^tarwe|^rogge|^spelt|^meergranen)(?!.*kruim)/, [['snee', 'sneeën', 35]]],
  [/^beschuit/, [['stuk', 'stuks', 10]]],
  [/knackebrod|knäckebröd|cracker|rijstwafel|maiswafel/, [['stuk', 'stuks', 10]]],
  [/^stroopwafel/, [['stuk', 'stuks', 30]]],
  [/^(koek|biscuit|speculaas|bitterkoek|kano|gevulde koek)/, [['stuk', 'stuks', 15]]],
  [/^chocolade(?!melk|pasta|vla|pudding|drank)/, [['blokje', 'blokjes', 5], ['reep', 'repen', 50]]],
  [/souffl|soufle/, [['stuk', 'stuks', 70]]],
  [/oliebol|poffertje|appelbeignet/, [['stuk', 'stuks', 80]]],
  [/^kaas(?!.*(souffl|soufle|stengel))/, [['plak', 'plakken', 20], ['blokje', 'blokjes', 5]]],
  [/(vleeswaren|^ham|achterham|schouderham|rookvlees|rosbief|salami|cervelaat|boterhamworst|leverworst|gekookte worst|kipfilet vleeswaren|kalkoenfilet|filet americain|pate|smeerworst)/, [['plak', 'plakken', 15]]],
  [/^(boter|halvarine|margarine|roomboter|bak- en braadvet)(?!\w*(koek|taart|cake|babbelaar|ham))/, [['dun laagje op 1 snee', 'dunne laagjes', 5], ['theelepel', 'theelepels', 5], ['eetlepel', 'eetlepels', 12]]],
  [/^(pindakaas|chocoladepasta|hazelnootpasta|notenpasta|jam|appelstroop|honing|stroop)/, [['laagje op 1 snee', 'laagjes', 15], ['theelepel', 'theelepels', 7], ['eetlepel', 'eetlepels', 20]]],
  [/^(hagelslag|vlokken|muisjes|gestampte muisjes)/, [['laagje op 1 snee', 'laagjes', 15], ['eetlepel', 'eetlepels', 10]]],
  [/^ei\b|^eieren|^ei kippen/, [['stuk', 'stuks', 55]]],
  [/^(bier|pils|radler)/, [['glas', 'glazen', 250], ['flesje', 'flesjes', 300]]],
  [/^wijn/, [['glas', 'glazen', 125]]],
  [/^(koffie|thee|cappuccino|latte|espresso)/, [['kopje', 'kopjes', 125], ['mok', 'mokken', 250]]],
  [/^(melk|karnemelk|chocolademelk|yoghurtdrank|drinkyoghurt|sojadrank|haverdrank|amandeldrank|rijstdrank|sinaasappelsap|appelsap|sap|jus|limonade|frisdrank|cola|ice tea|water|smoothie|kefir)/, [['glas', 'glazen', 200], ['beker', 'bekers', 250]]],
  [/^(skyr)/, [['bakje', 'bakjes', 150], ['schaaltje', 'schaaltjes', 150], ['eetlepel', 'eetlepels', 15], ['hele bak', 'hele bakken', 450]]],
  [/^(yoghurt|kwark|vla|pudding|griesmeelpap|cottage cheese|hüttenkäse|huttenkase)/, [['schaaltje', 'schaaltjes', 150], ['eetlepel', 'eetlepels', 15], ['hele bak', 'hele bakken', 500]]],
  [/^(havermout|muesli|cornflakes|ontbijtgranen|granola|brinta|cruesli|pap )/, [['eetlepel', 'eetlepels', 10], ['portie', 'porties', 40]]],
  [/^(rijst|pasta|macaroni|spaghetti|mie|noedels|couscous|quinoa|bulgur)(?!\w*(vla|pap|saus|pudding|wafel|koek|taart|melk|drank)).*rauw/, [['portie (droog)', 'porties', 70]]],
  [/^(rijst|pasta|macaroni|spaghetti|mie|noedels|couscous|quinoa|bulgur)(?!\w*(vla|pap|saus|pudding|wafel|koek|taart|melk|drank))/, [['opscheplepel', 'opscheplepels', 50], ['portie', 'porties', 200]]],
  [/^aardappel/, [['stuk', 'stuks', 70], ['opscheplepel', 'opscheplepels', 50]]],
  [/^(frites|patat)/, [['portie', 'porties', 150]]],
  [/^appelmoes/, [['schaaltje', 'schaaltjes', 150], ['eetlepel', 'eetlepels', 20]]],
  [/^appel(?!moes|stroop|sap|flap|carre|taart|gebak|beignet)/, [['stuk', 'stuks', 130]]],
  [/^peer/, [['stuk', 'stuks', 150]]], [/^banaan/, [['stuk', 'stuks', 120]]], [/^sinaasappel(?!sap)/, [['stuk', 'stuks', 140]]],
  [/^(mandarijn|clementine)/, [['stuk', 'stuks', 70]]], [/^kiwi/, [['stuk', 'stuks', 75]]], [/^(perzik|nectarine)/, [['stuk', 'stuks', 120]]],
  [/^(aardbei|bes|bessen|druif|druiven|kers|framboos|frambozen|braam|bramen|bosbes)/, [['handje', 'handjes', 50], ['schaaltje', 'schaaltjes', 125]]],
  [/^(noten|pinda|amandel|cashew|walnoot|hazelnoot|pistache|studentenhaver)/, [['handje', 'handjes', 25]]],
  [/^(chips|zoutje|popcorn)/, [['handje', 'handjes', 15], ['zakje', 'zakjes', 25]]],
  [/^olie(?!bol)/, [['eetlepel', 'eetlepels', 10], ['theelepel', 'theelepels', 4]]],
  [/^suiker/, [['theelepel', 'theelepels', 4], ['klontje', 'klontjes', 4]]],
  [/^(mayonaise|fritessaus|ketchup|mosterd|saus|dressing|curry|satesaus|pindasaus|knoflooksaus|cocktailsaus)/, [['eetlepel', 'eetlepels', 15], ['bakje', 'bakjes', 30]]],
  [/^soep/, [['kom', 'kommen', 250], ['kop', 'koppen', 150]]],
  [/^pizza/, [['punt', 'punten', 100], ['hele pizza', "hele pizza's", 350]]],
  [/^(kroket|frikandel|bamischijf|nasischijf|kaassouffle|loempia)/, [['stuk', 'stuks', 70]]],
  [/^(kipfilet|kip |kippenpoot|kippendij|biefstuk|gehakt|varkens|rund|hamburger|schnitzel|slavink|braadworst|rookworst|speklap|karbonade|zalm|kabeljauw|tonijn|lekkerbekje|kibbeling|vis(?!soep))/, [['stuk', 'stuks', 100]]],
  [/^(?!.*(chips|saus|soep))(andijvie|spinazie|broccoli|bloemkool|sperzieboon|boon|bonen|wortel|peen|kool|erwt|doperwt|courgette|paprika|champignon|prei|ui |uien|tomaat|komkommer|sla|groente|aubergine|asperge|witlof|spruit)/, [['opscheplepel', 'opscheplepels', 50], ['portie', 'porties', 150]]]
];
function measuresFor(it){
  const n = foldText(it.nevoName || it.name || ''), ml = it.unit === 'ml' || !!(it.nevo && NEVO && NEVO.get(it.nevo)?.ml) || (DRINK_RE.test(n) && !NOT_DRINK.test(n)) || /^(bier|pils|radler|wijn)/.test(n);
  const hit = MEASURES.find(([re]) => re.test(n));
  return [...(hit ? hit[1] : []).map(([u, pl, g]) => ({ u, pl, g, ml })), { u: ml ? 'ml' : 'g', pl: ml ? 'ml' : 'g', g: 1, ml }];
}
/* Switch an item to another measure: the same food per gram, now as "1 snee" (or 100 g). */
function setMeasure(it, m){
  const g0 = it.grams > 0 ? it.grams : 0; if (!g0) return;
  const per = v => v == null ? v : v / g0, mass = m.u === 'g' || m.u === 'ml', q = mass ? 100 : 1, gUnit = mass ? 1 : m.g;
  const pg = { kcal: per(it.kcal), p: per(it.p), c: per(it.c), f: per(it.f), sf: per(it.sf), ml: it.ml != null ? per(it.ml) : null };
  it.unit = m.u; it.unitPl = m.pl;
  it.base = { ...it.base, g: gUnit, kcal: pg.kcal * gUnit, p: pg.p * gUnit, c: pg.c * gUnit, f: pg.f * gUnit, sf: pg.sf != null ? pg.sf * gUnit : null, ml: pg.ml != null ? pg.ml * gUnit : it.base.ml };
  setQty(it, q);
  if (it.nevo) applyNevo(it);
}
/* NEVO while you type: the table is in the app itself, so this is instant, also offline, and costs no AI. */
function nevoResHTML(q){
  if (!NEVO || String(q || '').trim().length < 2) return '';
  const hits = nevoCandidates(q, 8, false);
  if (!hits.length) return '';
  return `<div class="eyebrow">Uit de NEVO-tabel</div><div class="offres">${hits.map(n => `<button data-nevopick="${n.code}"><span class="grow" style="min-width:0"><b>${esc(n.name)}</b><span class="note num">${(() => { const m = measuresFor({ name: n.name, nevo: n.code, unit: n.ml ? 'ml' : 'g' })[0]; return m.g > 1 ? `1 ${m.u}: ${r0(n.kcal * m.g / 100)} kcal · ` : ''; })()}${r0(n.kcal)} kcal per 100 ${n.ml ? 'ml' : 'g'}</span></span><span class="add" style="width:30px;height:30px;border-radius:9px;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center;font-weight:700">+</span></button>`).join('')}</div>`;
}
/* A NEVO product as a result: 100 g (drinks 200 ml) to start with, the amount can be changed in the sheet. */
function nevoResult(code){
  const n = NEVO && NEVO.get(Number(code)); if (!n) return null;
  const u = n.ml ? 'ml' : 'g', g = n.ml ? 200 : 100;
  const it = applyNevo(mkItem({ name: n.name, qty: g, unit: u, grams: g, nevo: n.code, ...(n.ml ? { ml: g } : {}) }));
  const m0 = measuresFor(it)[0]; if (m0 && m0.g > 1) setMeasure(it, m0);
  return { title: n.name, icon: '', items: [it], mult: 1, confidence: '', score: null, tip: '', src: 'nevo', portions: [] };
}
function searchHTML(){
  const Q = L.search;
  return `
    <div class="row" style="gap:8px;align-items:flex-end"><label class="field grow">Product of merk<input id="offQ" enterkeyhint="search" autocomplete="off" value="${esc(Q.q)}" placeholder="Bijv. magere kwark of AH volkoren brood"></label>
      <button class="btn" data-act="off-go" ${Q.busy ? 'disabled' : ''}>Zoeken</button></div>
    <div id="nevoRes">${nevoResHTML(Q.q)}</div>
    ${Q.results.length ? '<div class="eyebrow">Merkproducten</div>' : ''}
    ${Q.busy ? '<div class="thinking"><span class="dots"><i></i><i></i><i></i></span>Zoeken in de productdatabase…</div>' : ''}
    ${Q.error ? `<div class="err">${esc(Q.error)}</div>` : ''}
    ${Q.note ? `<p class="note">${esc(Q.note)}</p>` : ''}
    ${Q.results.length ? `<div class="offres">${Q.results.map((h, i) => { const g = String(h.nutriscore_grade || '').toLowerCase();
      return `<button data-offpick="${i}">${NUTRI_COL[g] ? `<span class="ns" style="background:${NUTRI_COL[g]}" aria-label="Nutri-Score ${g}">${g}</span>` : ''}<span class="grow" style="min-width:0"><b>${esc(offName(h))}</b><span class="note num">${r0(offKcal100(h.nutriments))} kcal per 100 ${/\d\s*(ml|cl|l)\b/i.test(String(h.quantity || '')) ? 'ml' : 'g'}${h.quantity ? ' · ' + esc(h.quantity) : ''}</span></span><span class="add" style="width:30px;height:30px;border-radius:9px;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center;font-weight:700">+</span></button>`; }).join('')}</div>` : ''}
    <button class="btn block ghost" data-act="label-photo">📷 Foto van het etiket</button>
    <p class="note">NEVO verschijnt al tijdens het typen. Met Zoeken komen er merkproducten van Open Food Facts bij, een gratis database van gebruikers. Niet gevonden? Maak een foto van de voedingswaardetabel op de verpakking. Alleen de etiketfoto gebruikt de AI.</p>
    <button class="add-line" data-mode="text">‹ Terug</button>`;
}

/* The same meal from the day before, while that meal is still empty. */
function yesterdayMeal(){
  if (!L || L.editId || day(L.day).entries.some(e => e.meal === L.meal)) return [];
  return day(shiftKey(L.day, -1)).entries.filter(e => e.meal === L.meal && !e.pending);
}
function yesterdayHTML(){
  const y = yesterdayMeal(); if (!y.length) return '';
  const names = y.map(e => e.name).join(', ');
  return `<button class="yest" data-act="copy-yesterday"><span class="ic" aria-hidden="true">↺</span>
    <span class="grow" style="min-width:0"><b>Zelfde ${MEAL_SHORT[L.meal].toLowerCase()} als gisteren</b><span class="note">${esc(names)} · ${r0(y.reduce((a, e) => a + e.kcal, 0))} kcal</span></span><span class="add" aria-hidden="true">+</span></button>`;
}
/* While typing: dishes from your own history that match, no AI needed. */
function matchesHTML(q){
  q = String(q || '').trim().toLowerCase();
  if (q.length < 2 || !L) return '';
  const words = q.split(/\s+/).filter(Boolean);
  const hits = foodHistory().filter(h => { const n = String(h.e.name).toLowerCase(); return words.every(w => n.includes(w)); }).slice(0, 4);
  L.lists.hist = hits.map(h => h.e);
  if (!hits.length) return '';
  return `<div class="eyebrow">Al eerder gegeten</div><div class="matches">${hits.map((h, i) => `<button data-quick="hist:${i}"><span class="mi">${foodIcon(h.e)}</span><span class="grow">${esc(h.e.name)}<span class="note num"> · ${r0(h.e.kcal)} kcal${h.count > 1 ? ` · ${h.count}×` : ''}</span></span><span class="add">+</span></button>`).join('')}</div>`;
}
/* Parts of your description that name a brand or supermarket product. They are looked up in Open Food Facts while
   the AI is thinking; a clear match replaces the AI's numbers for that part with the package values (per 100 g, times
   the AI's amount). No AI question extra, and at most 2.5 s extra wait. */
const BRAND_RE = /\b(ah|albert heijn|jumbo|lidl|aldi|plus|coop|spar|dirk|hoogvliet|vomar|ekoplaza|coca[- ]?cola|cola zero|pepsi|fanta|sprite|7up|red bull|monster|lipton|alpro|arla|campina|optimel|danone|activia|yakult|almhof|milbona|melkunie|mona|vifit|skyr|ehrmann|oatly|milka|tony'?s|verkade|c[oô]te d'?or|lindt|kit ?kat|snickers|mars|twix|bounty|m&m'?s|oreo|liga|sultana|bolletje|wasa|lay'?s|doritos|pringles|croky|duyvis|calv[eé]|becel|blue band|zeeuws meisje|unox|knorr|conimex|honig|grand'?italia|bertolli|hak|bonduelle|iglo|dr\.? ?oetker|ristorante|heineken|hertog jan|amstel|grolsch|nutella|hellmann'?s|heinz|kellogg'?s|special k|brinta|quaker|nesquik|chocomel|fristi|hipro|douwe egberts|nescaf[eé]|pickwick|mcdonald'?s|big mac|burger king|whopper|kfc|subway|starbucks)\b/i;
const OFF_STOP = /^(\d+([.,]\d+)?|een|één|twee|drie|vier|halve?|half|g|gr|gram|ml|cl|l|liter|stuks?|x|blik(je)?|fles(je)?|glas|glaasje|bak(je)?|pak(je)?|zak(je)?|reep|repen|portie|stuk(je)?|kop(je)?|beker(tje)?|potje|schaaltje|met|van|de|het)$/i;
// "perziksmaak" finds "perzik" (a package says "Skyr perzik"), "stukjes" and "smaak" alone say nothing.
const offTokens = t => String(t || '').toLowerCase().replace(/[^a-z0-9à-ÿ&' ]+/g, ' ').split(/\s+/)
  .map(w => w.length > 7 ? w.replace(/(smaak|aroma)$/, '') : w).filter(w => w.length >= 2 && !OFF_STOP.test(w) && !/^(stukjes|smaak|aroma|van|de)$/.test(w));
/* Open Food Facts allows about 10 searches a minute; working ahead and the real question often ask the same thing,
   so a search is remembered for 10 minutes. */
const offMemo = new Map();
async function offLookups(text){
  const parts = String(text).split(/,|;|\+|\n|\ben\b/i).map(x => x.trim()).filter(x => BRAND_RE.test(x)).slice(0, 3);
  return Promise.all(parts.map(async part => {
    const q = offTokens(part).join(' '); if (q.length < 3) return null;
    const hit = offMemo.get(q); if (hit && Date.now() - hit.t < 600000) return hit.p;
    const p = offLookupOne(q); offMemo.set(q, { t: Date.now(), p });
    if (offMemo.size > 60) offMemo.delete(offMemo.keys().next().value);
    return p;
  }));
}
async function offLookupOne(q){
  try {
    const want = offTokens(q), best = (offLocalHits(want).length ? offLocalHits(want) : await offSearch(q, 10, true)).filter(h => offHasEnergy(h.nutriments))
      .map(h => { const have = new Set(offTokens(offName(h) + ' ' + (Array.isArray(h.brands) ? h.brands.join(' ') : h.brands || ''))); return { h, sc: want.filter(w => have.has(w)).length / want.length }; })
      .sort((a, b) => b.sc - a.sc)[0];
    return best && best.sc >= 0.6 ? { q, hit: best.h } : null;   // only a clear match
  } catch (e) { return null; }
}
function applyOff(R, found){
  const used = new Set();
  (found || []).filter(Boolean).forEach(({ q, hit }) => {
    const want = new Set([...offTokens(q), ...offTokens(offName(hit))]);
    const pick = R.items.map((it, i) => ({ it, i, sc: offTokens(it.name).filter(w => want.has(w)).length })).filter(x => x.sc > 0 && !used.has(x.i) && x.it.grams > 0).sort((a, b) => b.sc - a.sc)[0];
    if (!pick) return;
    used.add(pick.i);
    const n = hit.nutriments || {}, g = pick.it.grams, per = k => num(n[k]) * g / 100;
    const sf = n['saturated-fat_100g'] != null && n['saturated-fat_100g'] !== '' ? per('saturated-fat_100g') : null;
    const fresh = mkItem({ name: offName(hit).slice(0, 80), qty: pick.it.qty, unit: pick.it.unit, unitPl: pick.it.unitPl, grams: g,
      kcal: offKcal100(n) * g / 100, p: per('proteins_100g'), c: per('carbohydrates_100g'), f: per('fat_100g'), sf, ml: pick.it.ml, hidden: pick.it.hidden });
    fresh.off = true;
    R.items[pick.i] = fresh;
  });
  return R;
}
/* Your own products: what you once scanned (barcode), photographed (label) or picked in Zoeken is remembered with its
   package values. When the AI names a part that is clearly that product ("AH skyr perziksmaak" after you scanned
   "Skyr perzik (AH)"), the package values are used for its weight instead of the AI's guess or a NEVO look-alike.
   Clearly: at least 2 words in common, covering most of the product's name and most of the part's name. */
function myProductFor(name){
  const want = offTokens(name); if (want.length < 2) return null;
  let best = null;
  Object.values(S.meta.products || {}).forEach(P => {
    const it = P.items && P.items.length === 1 && P.items[0]; if (!it || !(it.grams > 0) || !(it.kcal > 0)) return;
    const have = offTokens((P.title || it.name).replace(/[()]/g, ' ')), both = have.filter(w => want.includes(w)).length;
    const sc = Math.min(both / have.length, both / want.length);
    if (both >= 2 && sc >= 0.6 && (!best || sc > best.sc || (sc === best.sc && P.at > best.P.at))) best = { P, it, sc };
  });
  return best;
}
function applyMine(R){
  (R.items || []).forEach((it, i) => {
    if (!(it.grams > 0)) return;
    const hit = myProductFor(it.name); if (!hit) return;
    const src = hit.it, f = it.grams / src.grams, v = k => src[k] == null ? null : src[k] * f;
    const mine = mkItem({ name: (hit.P.title || src.name).slice(0, 80), qty: it.qty, unit: it.unit, unitPl: it.unitPl, grams: it.grams,
      kcal: v('kcal'), p: v('p'), c: v('c'), f: v('f'), sf: v('sf'), ml: it.ml, hidden: it.hidden });
    mine.off = true; mine.mine = true; mine.bron = 'jouw product';
    R.items[i] = mine;
  });
  return R;
}
/* You said one clear weight ("300 gram kibbeling", "250 ml melk") and there is one main item: if the AI used a
   different amount (more than 10% off), that item is scaled to what you said. Hidden extras (oil, sauce) stay. */
function honorAmount(R, text){
  const m = [...String(text).toLowerCase().matchAll(/(\d+(?:[.,]\d+)?)\s*(kg|kilo|gram|gr|g|ml|cl|liter|l)\b/g)];
  if (m.length !== 1) return;
  const v = num(m[0][1].replace(',', '.')) * ({ kg: 1000, kilo: 1000, cl: 10, liter: 1000, l: 1000 })[m[0][2]] || num(m[0][1].replace(',', '.'));
  const main = R.items.filter(i => !i.hidden);
  if (main.length !== 1 || !(v > 0) || !(main[0].grams > 0)) return;
  const it = main[0], f = v / it.grams;
  if (Math.abs(f - 1) <= 0.1 || f > 20 || f < 0.05) return;
  ['grams', 'kcal', 'p', 'c', 'f'].forEach(k => { it[k] = it[k] * f; });
  if (it.sf != null) it.sf *= f;
  if (it.ml != null) it.ml *= f;
  if (isMass(it.unit)) { it.qty = r0(v); it.base = { ...it.base, g: it.grams / it.qty, kcal: it.kcal / it.qty, p: it.p / it.qty, c: it.c / it.qty, f: it.f / it.qty, sf: it.sf != null ? it.sf / it.qty : null, ml: it.ml != null ? it.ml / it.qty : null }; }
  else { const q = it.qty || 1; it.base = { ...it.base, g: it.grams / q, kcal: it.kcal / q, p: it.p / q, c: it.c / q, f: it.f / q, sf: it.sf != null ? it.sf / q : null, ml: it.ml != null ? it.ml / q : null }; }
  it.fixed = true;
}
/* The food question with everything around it: Open Food Facts at the same time for brands, then the checks. */
/* later: show the answer straight away and look the missing items up afterwards; later() is called when that's done. */
/* The answer shows at once; what NEVO doesn't have exactly is looked up behind it and filled in when it comes
   (also when you already saved it). */
function fillAfter(R, cur){
  if (!webTodo(R).length) return;
  R.looking = webTodo(R).map(i => i.name);
  webFill(R).catch(() => {}).finally(() => {
    delete R.looking;
    if (R.savedAs) { lookupIntoEntry(R, R.savedAs); save(); return; }
    if (L !== cur || cur.result !== R) return;
    const a = document.activeElement; if (!(a && /INPUT|TEXTAREA/.test(a.tagName) && a.closest('.sheet'))) renderSheet();
  });
}
async function estimateFood(text, maxMs, later, opts = {}){
  offPrefetch(text);   // the parts of the text, searched while the AI thinks
  const offP = BRAND_RE.test(text) ? offLookups(text) : Promise.resolve([]);
  const res = await aiJSON(analysisPrompt(text), maxMs, FOOD_SCHEMA, 0, null, false, opts.kind || 'eten');
  const out = resultFromAI(res); if (out.error) return out;
  honorAmount(out.result, text);
  // Open Food Facts started at the same time as the AI. Not back yet after 2.5 s: the answer shows already, and the
  // package values replace the guess as soon as they come in (working ahead simply waits a little longer).
  const found = await Promise.race([offP, sleep(opts.noWeb ? 6000 : 2500).then(() => null)]);
  if (found) applyOff(out.result, found);
  else if (later) offP.then(f => {
    const n0 = out.result.items.filter(i => i.off).length;
    applyOff(out.result, f); applyMine(out.result);
    if (out.result.items.filter(i => i.off).length > n0) later(out);
  }).catch(() => {});
  applyMine(out.result);
  // Searching is paused right now: mark what should have been looked up, so it is looked up later (see lookLater).
  if (S.meta.ai.searchCool > Date.now()) out.result.items.filter(i => (!i.nevo || i.approx) && !i.off && i.grams > 0).forEach(i => { i.lookNo = 'limiet'; });
  if (opts.noWeb) return out;   // worked out ahead: the web lookup only happens once you really ask (see analyze)
  if (later && webTodo(out.result).length) {
    out.result.looking = webTodo(out.result).map(i => i.name);
    webFill(out.result).catch(() => {}).finally(() => { delete out.result.looking; later(out); });
  } else await webFill(out.result);
  return out;
}
async function analyze(fresh){
  L.text = $('#aiText')?.value ?? L.text ?? '';
  if (!L.text.trim()) { L.error = 'Beschrijf eerst wat je hebt gegeten.'; renderSheet(); return; }
  L.error = ''; L.errCode = '';
  const hit = !fresh && cacheGet(L.text);
  if (hit) { L.result = applyMine({ ...hit, cached: true }); L.cacheText = L.text; renderSheet(); return; }
  // Offline (also via Enter on the keyboard): keep it straight away instead of waiting for an error.
  if (navigator.onLine === false) { savePending(); return; }
  L.busy = true; const tok = ++L.token; renderSheet();
  const cur = L;
  // Worked out ahead while you typed (same text): that answer is used, ready or nearly ready.
  const pre = !fresh && PRE && PRE.key === cacheKey(cur.text) ? PRE : null; PRE = null;
  try {
    const later = o => {
      // Already saved before the lookup was done: the entry in your day gets the looked-up numbers too.
      if (o.result.savedAs) { if (lookupIntoEntry(o.result, o.result.savedAs)) cachePut(cur.text, { ...o.result, title: o.result.savedAs.name, mult: o.result.savedAs.mult }); save(); return; }
      if (L !== cur || cur.result !== o.result) return;
      cachePut(cur.text, o.result); save();
      // Not while you are typing in the sheet; the new numbers show on the next change.
      const a = document.activeElement; if (!(a && /INPUT|TEXTAREA/.test(a.tagName) && a.closest('.sheet'))) renderSheet();
    };
    // The question that is already on its way goes to the same model the normal question would get, so it is simply
    // awaited (asking again alongside would only cost a second request). Failed: then the normal way below.
    let out = pre ? await pre.p : null;
    if (out && out.fromPre && out.result && webTodo(out.result).length) {
      out.result.looking = webTodo(out.result).map(i => i.name);
      webFill(out.result).catch(() => {}).finally(() => { delete out.result.looking; later(out); });
    }
    // 40 seconds at most for typed food (it used to be a minute): each slow model hands over after ± 12 to 25 s anyway.
    if (!out || out.error) out = await estimateFood(cur.text, 40000, later);
    if (L !== cur || cur.token !== tok) return;
    if (out.error) cur.error = out.error;
    else { cur.result = out.result; cur.cacheText = cur.text; if (!out.result.looking) { cachePut(cur.text, out.result); save(); } }
  } catch (e) { if (L !== cur || cur.token !== tok) return; cur.error = errCopy(e); cur.errCode = (e && e.code) || 'upstream'; }
  cur.busy = false; renderSheet();
}
/* The lookup finished after you saved: update that entry, unless you removed or changed it in the meantime. */
function lookupIntoEntry(R, sv){
  const e = ((S.days[sv.day] || {}).entries || []).find(x => x.id === sv.id);
  if (!e || e.kcal !== sv.kcal) return false;
  entryFromLookup(e, R, sv.kcal);
  sv.kcal = e.kcal;   // a second update (package values after the web lookup) still finds it
  return true;
}
/* Put looked-up items into a saved entry: totals again, sources along, and a message when the kcal changed. */
function entryFromLookup(e, R, was){
  const t = itemsTotals(R.items, e.mult || 1);
  Object.assign(e, { items: R.items.map(({ base, ...i }) => ({ ...i, kcal: r1(i.kcal), p: r1(i.p), c: r1(i.c), f: r1(i.f), ...sfOut(i), ...(i.ml != null ? { ml: r0(i.ml) } : {}) })),
    kcal: r0(t.kcal), p: r1(t.p), c: r1(t.c), f: r1(t.f), sf: t.sf != null ? r1(t.sf) : null, ...(R.sources && R.sources.length ? { sources: R.sources } : {}) });
  save(); if (!sheetOpen()) render();
  if (Math.abs(e.kcal - was) >= 5) toast(`${e.name} bijgewerkt met de opgezochte waarde: ${e.kcal} kcal (was ${was}).`);
}
/* Looking up later: items in your day that could not be looked up (the search limit, or it failed) are tried again
   by themselves, when the app opens or comes back, when you are online again, and every 5 minutes while it is open.
   Today and yesterday only, at most 3 tries per meal and 2 meals at a time, so it doesn't eat your limit. */
const LOOK_AGAIN = i => i.lookNo === 'limiet' || i.lookNo === 'mislukt';
let lookLaterBusy = false;
async function lookLater(){
  if (lookLaterBusy || !S.profile || !S.meta.ai.key || S.meta.ai.searchCool > Date.now() || navigator.onLine === false || Date.now() - aiUserAt < 90000) return;
  const todo = [todayKey(), shiftKey(todayKey(), -1)].flatMap(k => ((S.days[k] || {}).entries || [])
    .filter(e => !e.pending && (e.lookTries || 0) < 3 && (e.items || []).some(LOOK_AGAIN)).map(e => [k, e])).slice(0, 2);
  if (!todo.length) return;
  lookLaterBusy = true;
  try {
    for (const [k, e] of todo) {
      const R = { items: e.items.map(i => Object.assign(mkItem(i), { ...(i.lookNo ? { lookNo: i.lookNo } : {}), ...(i.approx ? { approx: true } : {}) })), sources: e.sources || [] };
      const was = e.kcal, only = R.items.filter(LOOK_AGAIN);
      // You started asking something yourself in the meantime: stop, your question goes first.
      if (Date.now() - aiUserAt < 90000) break;
      // No free model right now: nothing asked, so it doesn't count as one of the 3 tries either.
      webFillKind = 'later'; try { await webFill(R, only); } catch (err) { if (err && err.code === 'quiet') break; } finally { webFillKind = 'opzoeken'; }
      e.lookTries = (e.lookTries || 0) + 1;
      const cur = ((S.days[k] || {}).entries || []).find(x => x.id === e.id);
      if (!cur || cur.kcal !== was) continue;                         // removed or changed in the meantime
      if (only.some(i => !i.lookNo)) entryFromLookup(cur, R, was);    // something was found
      else { cur.items.forEach((i, n) => { if (R.items[n] && R.items[n].lookNo !== i.lookNo) i.lookNo = R.items[n].lookNo; }); save(); }
      if (S.meta.ai.searchCool > Date.now()) break;
    }
  } finally { lookLaterBusy = false; }
}
setInterval(lookLater, 5 * 60000);
window.addEventListener('online', () => setTimeout(lookLater, 4000));
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(lookLater, 3000); });
/* A recipe shared to Knabbel (Allerhande, a website, Instagram, or just text): read it, and work out one portion.
   Websites mostly describe their recipe in a standard block (schema.org Recipe); Instagram only gives its caption. */
function recipeFromPage(pg){
  const out = { name: '', yield: 0, ingr: [], text: '' };
  const walk = x => { if (!x || typeof x !== 'object') return null; if (Array.isArray(x)) { for (const y of x) { const r = walk(y); if (r) return r; } return null; }
    const t = [].concat(x['@type'] || []); if (t.includes('Recipe')) return x; return walk(x['@graph']) || walk(x.mainEntity) || null; };
  for (const raw of pg.ld || []) { let j; try { j = JSON.parse(raw); } catch (e) { continue; } const r = walk(j); if (!r) continue;
    out.name = String(r.name || '').trim(); out.ingr = [].concat(r.recipeIngredient || r.ingredients || []).map(x => String(x).replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 40);
    const y = [].concat(r.recipeYield || [])[0]; out.yield = parseInt(String(y || '').match(/\d+/)?.[0] || '0', 10) || 0; break; }
  if (!out.name) out.name = String(pg.ogTitle || pg.title || '').split(/ [|–-] /)[0].trim();
  if (!out.ingr.length) out.text = String(pg.ogDesc || '').trim() || String(pg.text || '').slice(0, 4000);
  return out;
}
async function shareReceived(sh){
  if (!S.profile || !sh || !(sh.text || '').trim()) return;
  const text = String(sh.text).trim(), url = (text.match(/https?:\/\/\S+/) || [])[0];
  openLog({ meal: logMeal(todayKey()) });
  const cur = L, tok = ++cur.token; cur.busy = true; cur.busyText = url ? `${S.meta.pet.name} leest het recept van ${url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}…` : `${S.meta.pet.name} leest het recept…`; renderSheet();
  try {
    let R = { name: String(sh.subject || '').slice(0, 80), yield: 0, ingr: [], text: url ? '' : text };
    if (url) { const pg = await nat('recipe.fetch', { url }); R = recipeFromPage(pg); if (!R.name) R.name = String(sh.subject || '').slice(0, 80); }
    if (!R.ingr.length && R.text.length < 30) throw { code: 'no_recipe' };
    if (L !== cur || cur.token !== tok) return;
    cur.busyText = '';  // from here the normal "rekent je eten uit" with a stop button
    const body = R.ingr.length ? `Ingrediënten:\n- ${R.ingr.join('\n- ')}` : `Tekst bij het recept:\n${R.text.slice(0, 3000)}`;
    const ask = `Dit is een recept${R.name ? ` ("${R.name}")` : ''}${R.yield ? ` voor ${R.yield} ${R.yield === 1 ? 'portie' : 'porties'}` : ' (staat er geen aantal porties bij, schat het dan uit de hoeveelheden)'}. ${body}\nReken uit wat één portie is: geef alle onderdelen met de hoeveelheid voor 1 portie (dus de hoeveelheden gedeeld door het aantal porties). Gebruik "${R.name || 'het gerecht'}" als titel.`;
    cur.text = ''; renderSheet();
    const res = await aiJSON(analysisPrompt(ask), 60000, FOOD_SCHEMA, 0, null, false, 'recept');
    if (L !== cur || cur.token !== tok) return;
    const out = resultFromAI(res);
    if (L !== cur || cur.token !== tok) return;
    if (out.error) cur.error = out.error;
    else { out.result.src = 'recept'; if (R.name) out.result.title = R.name.slice(0, 80); if (url) out.result.url = url; cur.result = out.result; fillAfter(cur.result, cur); }
  } catch (e) {
    if (L !== cur || cur.token !== tok) return;
    cur.error = e && e.code === 'no_recipe' ? 'Ik kon op die pagina geen recept vinden. Kopieer de ingrediënten en deel die tekst, of beschrijf het hieronder.' : errCopy(e);
  }
  cur.busy = false; cur.busyText = ''; renderSheet();
}
async function checkShare(){ if (!Native || !S.profile) return; try { const sh = await nat('share.take'); if (sh && sh.text) shareReceived(sh); } catch (e) {} }
window.onNativeShare = checkShare;
/* In the browser (an iPhone) photos come from the phone's own camera/photo picker; they are made small here,
   like the Android app does, before anything is sent. */
function webImage(camera, max = 768){
  return new Promise((res, rej) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    if (camera) inp.setAttribute('capture', 'environment');
    inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return res(null); try { res(await shrinkImage(f, max)); } catch (e) { rej(e); } };
    inp.click();
  });
}
async function shrinkImage(file, max){
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { mime: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.8).split(',')[1], canvas: c };
  } finally { URL.revokeObjectURL(url); }
}
const pickImage = (how, max) => Native ? nat(how === 'pick' ? 'photo.pick' : 'photo.take', max ? { max } : {}) : webImage(how !== 'pick', max);
/* The nutrition table on the package, read by the AI: per 100 g or ml, copied, not estimated. Then it works like a
   scanned product; with a barcode the app remembers it, so the next scan is instant. */
const LABEL_PROMPT = `Op de foto staat de voedingswaardetabel (en misschien de voorkant) van een verpakt product. Lees de waarden precies over; schat niets.
Geef de waarden per 100 g of per 100 ml: energie in kcal (niet kJ), eiwit, koolhydraten, vet, verzadigd vet (g). Staat er alleen "per portie", reken dan om naar 100 g met de portiegrootte.
Staat er een portiegrootte, geef die in gram of ml. Geef de naam en het merk als die te zien zijn, en de inhoud van de verpakking (bijv. "500 g").
Antwoord met alleen JSON: {"naam":"","merk":"","per":"100g","kcal":0,"eiwit":0,"koolhydraten":0,"vet":0,"verzadigd":0,"portie_gram":0,"inhoud":""}
Is er geen voedingswaardetabel te lezen: {"onleesbaar":true,"reden":"korte uitleg"}`;
async function labelPhoto(){
  const cur = L; if (!cur) return;
  let img; try { img = await pickImage('take', 1600); } catch (e) { toast('De foto lukte niet. Probeer het nog eens.'); return; }
  if (!img || !img.data || L !== cur) return;
  cur.busy = true; cur.busyText = 'Etiket lezen…'; cur.shot = `data:${img.mime};base64,${img.data}`; cur.error = ''; cur.errCode = ''; const tok = ++cur.token; renderSheet();
  try {
    const j = await aiJSON(LABEL_PROMPT, 45000, LABEL_SCHEMA, 0, img, false, 'etiket');
    if (L !== cur || cur.token !== tok) return;
    const k = num(j && j.kcal), pp = num(j && j.eiwit), cc = num(j && j.koolhydraten), ff = num(j && j.vet), macro = 4 * pp + 4 * cc + 9 * ff;
    if (!j || j.onleesbaar || !(k > 0)) { cur.error = `Ik kon het etiket niet lezen${j && j.reden ? ` (${String(j.reden).slice(0, 80)})` : ''}. Maak de foto van dichtbij, recht en zonder schittering.`; cur.errCode = 'label'; }
    else if (macro > 0 && Math.abs(k - macro) / Math.max(k, macro) > 0.35) { cur.error = 'De getallen van het etiket kloppen niet met elkaar. Maak de foto nog eens, scherper.'; cur.errCode = 'label'; }
    else {
      const ml = /ml/i.test(String(j.per || '')), name = [String(j.naam || '').trim(), String(j.merk || '').trim()].filter(Boolean);
      const p = { product_name: name[0] || cur.text || 'Product van het etiket', brands: name[1] || '', quantity: String(j.inhoud || '') || (ml ? '1 ml' : ''),
        serving_quantity: num(j.portie_gram) || '', nutriments: { 'energy-kcal_100g': k, proteins_100g: pp, carbohydrates_100g: cc, fat_100g: ff, 'saturated-fat_100g': j.verzadigd == null ? '' : num(j.verzadigd) },
        categories_tags: ml ? ['drinks'] : [] };
      const R = productResult(p, cur.scanCode || '');
      if (R) { R.label = true; cur.result = R; rememberProduct(cur.scanCode || 'etiket:' + foldText(R.title), R); save(); }
      else { cur.error = 'Ik kon het etiket niet lezen. Probeer het nog eens.'; cur.errCode = 'label'; }
    }
  } catch (e) { if (L !== cur || cur.token !== tok) return; cur.error = errCopy(e); cur.errCode = ''; }
  cur.busy = false; cur.busyText = ''; cur.shot = ''; renderSheet();
}
/* A barcode from a photo (the browser can't scan live on an iPhone): the browser's own reader when it has one,
   otherwise ZXing, loaded only then. */
function loadScript(src, integrity){ return new Promise((ok, no) => { const sc = document.createElement('script'); if (integrity) { sc.integrity = integrity; sc.crossOrigin = 'anonymous'; } sc.src = src; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); }); }
async function readBarcode(img){
  if ('BarcodeDetector' in window) {
    try { const r = await new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] }).detect(img.canvas); if (r[0]) return r[0].rawValue; } catch (e) {}
  }
  // With its fingerprint (SRI): a changed file on the CDN is refused instead of run.
  if (!window.ZXing) await loadScript('https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js', 'sha384-BzBxP10ZE72aitqj5UMmUsbKFliP/DZqA8Wq+BNNhlIJDGoEd1tpkMYXOg9+n6sB');
  const Z = window.ZXing, hints = new Map();
  hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.CODE_128]);
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  const reader = new Z.MultiFormatReader(); reader.setHints(hints);
  try { return reader.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(img.canvas)))).getText(); } catch (e) { return null; }
}
/* A photo of your plate: taken or picked on the phone, made small there, and sent along with the food question. */
async function photoAnalyze(how){
  const cur = L; if (!cur) return;
  cur.photoNote = (($('#photoNote') || {}).value || '').trim();
  let img; try { img = await pickImage(how); } catch (e) { toast('De foto lukte niet. Probeer het nog eens.'); return; }
  if (!img || !img.data || L !== cur) return;
  // The photo is only kept in memory while it's being looked at (L is never saved), and is let go afterwards.
  cur.busy = true; cur.error = ''; cur.shot = `data:${img.mime};base64,${img.data}`; const tok = ++cur.token; renderSheet();
  const text = `Er is een foto van het eten bijgevoegd. Herken wat erop staat en schat de hoeveelheden aan de hand van het bord, bestek en de verpakking als die te zien is. Tel olie, boter en saus mee als dat aannemelijk is.
Bij een foto is er geen NEVO-lijst: laat "nevo" weg. Geef elk onderdeel een gewone Nederlandse productnaam met de bereiding (bv. "Rijst gekookt", "Kipfilet gebakken", "Broccoli gekookt") en geef zelf kcal, eiwit, koolhydraten, vet en verzadigd voor het aantal gram. De app zoekt het product daarna zelf op in de NEVO-tabel.${cur.photoNote ? ` De gebruiker vertelt erbij: ${cur.photoNote}` : ''}`;
  try {
    const res = await aiJSON(analysisPrompt(text, null), 50000, FOOD_SCHEMA, 0, img, false, 'foto');
    if (L !== cur || cur.token !== tok) return;
    const out = resultFromAI(res);
    if (!out.error) out.result.items = out.result.items.map(nevoGuess);
    if (L !== cur || cur.token !== tok) return;
    if (out.error) cur.error = out.error;
    else { out.result.src = 'foto'; cur.result = out.result; cur.text = cur.photoNote || ''; fillAfter(cur.result, cur); }
  } catch (e) { if (L !== cur || cur.token !== tok) return; cur.error = errCopy(e); cur.errCode = ''; }
  cur.busy = false; cur.shot = ''; renderSheet();
}
/* Working it out ahead: when you stop typing for 1.5 s, the app already asks a roomy Lite model (hundreds a day, so your
   20 Flash questions a day are not touched; when none is free right now, nothing is asked). Tap "Bereken calorieën"
   with the same text and the answer is there at once, or sooner. Typed on after all: that answer is simply not used. */
let PRE = null, preT = null;
/* The app: open the connection to Open Food Facts when the add sheet opens (a tiny search), so the first real search
   doesn't have to set it up (that is more than half of its time). At most once a minute. */
let offWarmAt = 0;
function offWarm(){ if (!Native || Date.now() - offWarmAt < 60000) return; offWarmAt = Date.now(); offCall('food.search', { q: 'melk', size: 1, fields: 'code' }).catch(() => {}); }
function prefetchSoon(){ clearTimeout(preT); preT = setTimeout(prefetchFood, 1500); }
function prefetchFood(){
  if (!L || L.mode !== 'text' || L.result || L.busy || !sheetOpen()) return;
  const text = (($('#aiText') || {}).value || '').trim();
  if (text.length < 6 || !/[a-z]{3}/i.test(text) || navigator.onLine === false || cacheGet(text)) return;
  // The products for what you typed, at every pause (free; in the browser only with the AI question, because of its limit).
  if (Native) offPrefetch(text);
  if (!(S.meta.ai.key || '').trim()) return;
  const key = cacheKey(text); if (!key || (PRE && PRE.key === key)) return;
  // Working ahead now uses the same (scarce) Flash models as your question: at most 2 times per meal you type, so
  // changing the text a few times doesn't use up your 20 a day.
  if ((L.preN = (L.preN || 0) + 1) > 2) return;
  const me = { key };
  me.p = estimateFood(text, 30000, null, { kind: 'vooruit', noWeb: true }).catch(() => null).then(out => { if (!out || out.error) { if (PRE === me) PRE = null; } else out.fromPre = true; return out; });
  PRE = me;
}
/* No internet or the AI is busy: keep what you typed as a meal that gets calculated later. */
const LATER_CODES = ['network', 'busy', 'rate_limited', 'slow'];
function savePending(){
  const text = (($('#aiText') || {}).value ?? L.text ?? '').trim(); if (!text) return;
  const d = ensureDay(L.day), wasFirst = !firstLogKey();
  const base = L.editId && d.entries.find(e => e.id === L.editId);
  const entry = { id: L.editId || uidGen(), t: base ? base.t : entryTime(L.day, L.meal), meal: L.meal, name: text.slice(0, 80), text: text.slice(0, 1500), pending: true,
                  icon: '', mult: 1, items: [], kcal: 0, p: 0, c: 0, f: 0, src: 'pending', score: null, tip: '' };
  if (base) d.entries[d.entries.indexOf(base)] = entry; else d.entries.push(entry);
  save(); closeSheet();
  if (!base) afterNewEntries(d, wasFirst, 1);
  flash(entry.id); render();
  toast('Bewaard. Ik reken het uit zodra het weer lukt.');
}
const hasPending = k => day(k).entries.some(e => e.pending);
/* "Not everything logged": such a day doesn't count in averages, the weigh-in or the real burn. */
const isPartial = k => !!day(k).flags?.partial;
const fullDay = k => day(k).entries.length > 0 && !hasPending(k) && !isPartial(k);
let pendingBusy = false;
async function processPending(){
  if (pendingBusy || !S.profile || !(S.meta.ai.key || '').trim()) return;
  const list = Object.keys(S.days).sort().reverse().slice(0, 60).flatMap(k => (S.days[k].entries || []).filter(e => e.pending).map(e => [k, e]));
  if (!list.length) return;
  pendingBusy = true; let done = 0;
  try {
    for (const [k, e] of list) {
      if (L && L.editId === e.id) continue;
      let R = cacheGet(e.text || e.name);
      if (!R) {
        let out; try { out = await estimateFood(e.text || e.name, 45000); } catch (err) { break; }
        if (out.error) continue;
        R = out.result; cachePut(e.text || e.name, R);
      }
      const d = S.days[k]; const i = d ? d.entries.findIndex(x => x.id === e.id && x.pending) : -1; if (i < 0) continue;
      d.entries[i] = { ...buildEntry({ ...R, name: R.title }, e.meal), id: e.id, t: e.t, src: 'ai', tip: '' };
      done++; save(); checkWaterGoal(k);
    }
  } finally { pendingBusy = false; }
  if (done) { if (!sheetOpen()) render(); toast(done === 1 ? '1 bewaarde maaltijd uitgerekend' : `${done} bewaarde maaltijden uitgerekend`); }
}
window.addEventListener('online', () => setTimeout(processPending, 1500));
// Back in the app with internet: a phone often doesn't report "online" while the app was in the background.
document.addEventListener('visibilitychange', () => { if (!document.hidden && navigator.onLine !== false) setTimeout(processPending, 2000); });
// Connection gone or back while the add sheet is open: the button changes along (calculate / keep for later).
function onlineChanged(){ if (L && !L.result && !L.busy && sheetOpen()) { L.text = $('#aiText')?.value ?? L.text; renderSheet(); } }
window.addEventListener('online', onlineChanged);
window.addEventListener('offline', onlineChanged);

/* Logging for another day: the time is set on that day (a usual time for the meal), so "last bite" stays right. */
const MEAL_TIME = { ontbijt: 8, lunch: 12.5, diner: 18.5, snack: 15.5 };
/* Snacks sit between the meals: after breakfast, after lunch, or after dinner. That follows from when you logged it
   and which meals were there before it, so a new snack lands in the right place by itself (also older snacks). */
function snackSlot(e, d){
  const t = e.t || 0, before = m => d.entries.some(x => x.meal === m && x.t && x.t <= t);
  if (before('diner')) return 'eve';
  if (before('lunch')) return 'pm';
  if (!t) return 'pm';
  const h = new Date(t).getHours() + new Date(t).getMinutes() / 60;
  return h >= 21 ? 'eve' : h >= 14.5 ? 'pm' : 'am';
}
/* The sections on Today, in the order of the day. A snack section only shows when something is in it, plus (today)
   the one a snack would go into right now, so "+ Toevoegen" for a snack is always in the right place. */
function mealSections(d, isToday){
  const snacks = d.entries.filter(e => e.meal === 'snack');
  const now = isToday ? snackSlot({ t: Date.now() }, d) : snacks.length ? null : 'pm';
  const main = id => [id, MEALS.find(m => m[0] === id)[1], e => e.meal === id];
  const snack = (slot, label) => snacks.some(e => snackSlot(e, d) === slot) || slot === now ? [['snack', label, e => e.meal === 'snack' && snackSlot(e, d) === slot]] : [];
  return [main('ontbijt'), ...snack('am', 'Tussendoor'), main('lunch'), ...snack('pm', 'Tussendoor'), main('diner'), ...snack('eve', 'Na het eten')];
}
/* The clock time you logged it. Meals added to another day get a made-up time on the whole minute: no time then. */
const entryClock = e => e.t && e.t % 60000 ? new Date(e.t).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '';
function entryTime(k, meal){
  if (k === todayKey()) return Date.now();
  const d = dateOf(k), h = MEAL_TIME[meal] ?? 12; d.setHours(Math.floor(h), (h % 1) * 60, 0, 0); return d.getTime();
}
/* Briefly light up a new line on Today so you see where it went. */
let flashId = null;
function flash(id, eat){ flashId = id; setTimeout(() => { if (flashId === id) flashId = null; }, 1800);
  requestAnimationFrame(() => {
    const pet = document.querySelector('.ringpet .pet'), r = pet && pet.getBoundingClientRect();
    const watching = eat && r && r.width && r.bottom > 40 && r.top < innerHeight - 60 && !reduceMotion();
    const show = again => { const e = document.querySelector(`.entry[data-edit="${id}"]`); if (!e) return; e.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (again) replay(e, 'flash'); };
    if (watching) setTimeout(() => show(true), 1900);   // Knabbel eats (1.3 s), the ring gulps, then your new item
    else { show(false); replay(pet, 'hop'); }
  }); }

/* Improve an estimate with one sentence: the answer to the AI's question, or your own correction.
   The earlier estimate goes along, so you don't have to describe everything again. */
async function refineResult(extra){
  const cur = L, prev = cur && cur.result; if (!prev || !extra.trim()) return;
  const before = JSON.stringify({ titel: prev.title, items: prev.items.map(i => ({ naam: i.name, aantal: r1(i.qty), eenheid: i.unit, gram: r0(i.grams), kcal: r0(i.kcal) })) });
  const prompt = analysisPrompt(cur.text || prev.title, `${cur.text || prev.title} ${prev.items.map(i => i.name).join(' ')} ${extra}`) + `\n\nJe eerdere schatting was: ${before}\nAanvulling van de gebruiker: """${extra.slice(0, 300)}"""\nPas de schatting daarop aan en geef het volledige nieuwe antwoord in hetzelfde JSON-formaat, zonder "vraag".`;
  const keep = { title: ($('#r-title') || {}).value || prev.title, mult: prev.mult || 1 };
  cur.error = ''; cur.errCode = ''; cur.busy = true; cur.busyText = ''; const tok = ++cur.token; cur.result = null; renderSheet();
  try {
    const res = await aiJSON(prompt, 45000, FOOD_SCHEMA, 0, null, false, 'verbeter');
    if (L !== cur || cur.token !== tok) return;
    const out = resultFromAI(res);
    if (L !== cur || cur.token !== tok) return;
    if (out.error) { cur.result = prev; cur.error = out.error; }
    else { cur.result = { ...out.result, question: null, mult: keep.mult, title: keep.title !== prev.title ? keep.title : out.result.title }; if (!cur.cacheText && cur.text) cur.cacheText = cur.text; fillAfter(cur.result, cur); }
  } catch (e) { if (L !== cur || cur.token !== tok) return; cur.result = prev; cur.error = errCopy(e); }
  cur.busy = false; renderSheet();
}

function saveEntry(){
  const R = L.result; if (!R.items.length) { L.error = 'Voeg minstens één onderdeel toe.'; renderSheet(); return; }
  if (R.items.some(i => !(i.qty > 0))) { L.error = 'Vul bij elk onderdeel een hoeveelheid in, of haal het weg met ×.'; renderSheet(); return; }
  const mult = R.mult || 1, t = itemsTotals(R.items, mult);
  const meal = L.meal, title = (($('#r-title') || {}).value || R.title).trim();
  const entry = { id: L.editId || uidGen(), t: entryTime(L.day, meal), meal, name: title, icon: R.icon || '', mult, ...(R.portions && R.portions.length ? { portions: R.portions } : {}), ...(R.sources && R.sources.length ? { sources: R.sources } : {}), items: R.items.map(({ base, ...i }) => ({ ...i, kcal: r1(i.kcal), p: r1(i.p), c: r1(i.c), f: r1(i.f), ...sfOut(i), ...(i.ml != null ? { ml: r0(i.ml) } : {}) })),
                  kcal: r0(t.kcal), p: r1(t.p), c: r1(t.c), f: r1(t.f), sf: t.sf != null ? r1(t.sf) : null, src: R.src || 'manual', score: R.score || null, tip: R.tip || '', ...(R.code ? { code: R.code } : {}), ...(R.url ? { url: R.url } : {}) };
  const d = ensureDay(L.day);
  const wasFirst = !firstLogKey();
  if (L.editId) { const i = d.entries.findIndex(e => e.id === L.editId); if (i >= 0) { entry.t = d.entries[i].t; d.entries[i] = entry; } else d.entries.push(entry); }
  else d.entries.push(entry);
  if (R.looking) R.savedAs = { day: L.day, id: entry.id, kcal: entry.kcal, name: entry.name, mult };   // still being looked up: see lookupIntoEntry
  const isNew = !L.editId, cText = L.cacheText;
  // Eating one of the suggested ideas changes what's left, so the old suggestions are cleared (ask again for new ones).
  if (isNew && R.src === 'advies') { A.res = null; A.open = null; }
  if (cText && R.src === 'ai') cachePut(cText, { ...R, title, mult });  // your corrections win next time
  save(); closeSheet();
  const got = isNew ? afterNewEntries(d, wasFirst, 1) || 0 : 0;
  if (needsFill(entry)) scoreFillSoon();
  flash(entry.id, isNew); render();
  if (isNew) { petEat(isDrinkEntry(entry) ? 'drink' : 'eat', foodIcon(entry)); haptic(12);
    if (FL('moment') && !reduceMotion()) setTimeout(() => { const r = document.querySelector('.ringpet .ring.big'); if (r) replay(r, 'gulp'); }, 1500); }
  const nb1 = nbadgesOf(entry)[0];
  if (isNew) toast(`Toegevoegd aan ${MEAL_SHORT[meal]}${nb1 ? ' · ' + nb1[1] : ''}${got ? ` · +${got} 🌻` : ''}`, { label: 'Ongedaan maken', fn: () => collapseThen([entry.id], () => {
    d.entries = d.entries.filter(x => x.id !== entry.id);
    if (got) d.flags.seedMeals = d.flags.seedMeals.filter(m => m !== meal);
    S.meta.pet.seeds = Math.max(0, S.meta.pet.seeds - got); S.meta.pet.xp = Math.max(0, S.meta.pet.xp - 10); seedLog(-got, 'Ongedaan gemaakt');
    save(); render();
  }) });
  else toast('Opgeslagen');
}

