/* Open Food Facts inside the app: the Dutch products and a few well-known foreign ones (off.js, made by tools/off.py).
   A lookup by name, a barcode or a search first looks here (instant, also without internet); only what isn't in the
   list goes online. The list is loaded after the page is up (it is a big file), and a lookup before that simply goes online. */
let OFFL = null, offLoading = null;
function offLoad(){
  if (OFFL || offLoading) return offLoading || Promise.resolve(OFFL);
  if (Date.now() - offFailAt < 60000) return Promise.resolve(null);
  offLoading = new Promise(res => {
    const fail = () => { offLoading = null; offFailAt = Date.now(); res(null); };   // tried again later (not more than once a minute)
    const done = () => offBuild().then(x => { OFFL = x; try { delete window.OFF_DATA; } catch (e) { window.OFF_DATA = ''; } res(x); }).catch(fail);
    if (window.OFF_DATA) return done();
    // The same version number as the other files, so a new version brings a new list (see sw.js).
    const me = document.querySelector('script[src*="start.js"]'), v = me ? (me.src.split('?v=')[1] || '') : '';
    const s = document.createElement('script'); s.src = 'off.js' + (v ? '?v=' + v : ''); s.onload = done; s.onerror = fail;
    document.head.appendChild(s);
  });
  return offLoading;
}
/* The words of every product (name + brand) → which products have them, and the barcodes. Built in pieces so the page
   keeps responding. */
async function offBuild(){
  const lines = String(window.OFF_DATA || '').split('\n'), words = new Map(), codes = new Map();
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i].split('|'); if (a.length < 8) continue;
    codes.set(a[0], i);
    const tk = new Set(offTokens(a[1] + ' ' + a[2])); if (tk.has('albert') && tk.has('heijn')) tk.add('ah');   // "ah" and "albert heijn" are the same shop
    tk.forEach(w => { let l = words.get(w); if (!l) words.set(w, l = []); l.push(i); });
    if (i % 1000 === 999) await new Promise(r => setTimeout(r, 0));
  }
  return { lines, words, codes };
}
/* One line of the list as the answer Open Food Facts itself gives, so everything that works with online answers works
   with these too. */
function offToHit(line){
  const a = line.split('|'), ml = a[10] === '1';
  return { code: a[0], product_name: a[1], brands: a[2], serving_quantity: a[8] || '', quantity: a[9] ? `${a[9]} ${ml ? 'ml' : 'g'}` : '',
    categories_tags: ml ? ['en:beverages'] : [], nutriments: { ...(a[11] === '1' ? { 'alcohol_100g': 5 } : {}), 'energy-kcal_100g': +a[3], 'proteins_100g': +a[4], 'carbohydrates_100g': +a[5], 'fat_100g': +a[6], ...(a[7] !== '' ? { 'saturated-fat_100g': +a[7] } : {}) }, local: true };
}
/* Products that have most of these words (60% or more), the best known first (the list is in order of scans). */
function offLocalHits(core, max = 12){
  if (!OFFL || !core || !core.length) return [];
  const n = new Map();
  core.forEach(w => (OFFL.words.get(w) || []).forEach(i => n.set(i, (n.get(i) || 0) + 1)));
  // Most of the words first; then the product whose name has the fewest other words ("pindakaas" before "proteïne pindakaas
  // met stukjes"); then the best known. Looked at for the best 300 only.
  const top = [...n].filter(([, c]) => c / core.length >= 0.6).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 300).map(([i, c]) => {
    const a = OFFL.lines[i].split('|'), name = offTokens(a[1]), br = offTokens(a[2]);
    return { i, c, extra: name.filter(w => !core.includes(w) && !br.includes(w)).length };
  });
  return top.sort((a, b) => b.c - a.c || a.extra - b.extra || a.i - b.i).slice(0, max).map(x => offToHit(OFFL.lines[x.i]));
}
const offLocalCode = code => { if (!OFFL) return null; const c = String(code), i = [c, '0' + c, c.replace(/^0+/, ''), c.padStart(13, '0')].map(x => OFFL.codes.get(x)).find(x => x !== undefined); return i === undefined ? null : offToHit(OFFL.lines[i]); };
/* Starts loading a moment after the page is up. */
(window.requestIdleCallback || (f => setTimeout(f, 2500)))(() => setTimeout(offLoad, 1500), { timeout: 4000 });
