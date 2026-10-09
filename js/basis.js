/* Helpers, the bridge to the Android app and the stored state. */
/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const r0 = n => Math.round(Number(n) || 0);
const r1 = n => Math.round((Number(n) || 0) * 10) / 10;
const kgStr = n => String(r1(n)).replace('.', ',');
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const numStr = n => (n < 0 ? '−' : '') + Math.abs(n);   // a negative number with a real minus sign
const pad = n => String(n).padStart(2, '0');
const keyOf = d => { const x = new Date(d); return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
const todayKey = () => keyOf(new Date());
const dateOf = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const shiftKey = (k, n) => { const x = dateOf(k); x.setDate(x.getDate() + n); return keyOf(x); };
const daysBetween = (a, b) => Math.round((dateOf(b) - dateOf(a)) / 864e5);
const uidGen = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const num = v => Math.max(0, Number(String(v ?? '').replace(',', '.')) || 0);
const DAYS = ['zo','ma','di','wo','do','vr','za'];
const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
const shortDate = k => { const x = dateOf(k); return DAYS[x.getDay()] + ' ' + x.getDate() + ' ' + MONTHS[x.getMonth()]; };
function prettyDay(k){
  if (k === todayKey()) return 'Vandaag';
  if (k === shiftKey(todayKey(), -1)) return 'Gisteren';
  return shortDate(k);
}
const MEALS = [['ontbijt','Ontbijt'],['lunch','Lunch'],['diner','Avondeten'],['snack','Tussendoor']];
/* An emoji for a logged food: the AI's pick when it gave one, else a keyword match on the name. */
const FOOD_ICONS = [
  [/pindakaas/, '🥜'], [/bubbelthee|boba/, '🧋'], [/koffie|cappuccino|latte|espresso|macchiato/, '☕'], [/\bthee\b|groene thee|kruidenthee/, '🍵'],
  [/bier|pils|radler/, '🍺'], [/wijn|prosecco/, '🍷'], [/cocktail|mojito/, '🍹'], [/eiwitshake|proteine|shake|smoothie/, '🥤'],
  [/cola|frisdrank|fanta|sprite|limonade|ranja|ice ?tea|energy|red ?bull|\bsap\b|jus d/, '🥤'], [/chocomel|melk|karnemelk|yoghurtdrank/, '🥛'], [/\bwater\b|spa\b/, '💧'],
  [/pizza/, '🍕'], [/hamburger|burger/, '🍔'], [/friet|patat|frites|patatje/, '🍟'], [/hotdog|worstenbroodje|knakworst|rookworst|\bworst/, '🌭'],
  [/burrito|wrap|kapsalon|shoarma|kebab|d[oö]ner|gyros/, '🌯'], [/taco|nacho/, '🌮'], [/sushi/, '🍣'], [/dumpling|loempia/, '🥟'],
  [/pasta|spaghetti|macaroni|lasagne|penne|tagliatelle|ravioli|tortellini/, '🍝'], [/noedel|ramen|bami|mie\b/, '🍜'], [/curry|nasi|rijst|risotto|paella|biryani/, '🍛'],
  [/soep|bouillon/, '🍲'], [/salade|\bsla\b/, '🥗'], [/pannenkoek|poffertje|wafel/, '🥞'], [/croissant|saucijzenbroodje/, '🥐'],
  [/tosti|sandwich|broodje|boterham|brood|toast|cracker|beschuit|knäckebröd|bagel|pistolet/, '🍞'], [/omelet|\beieren\b|\bei\b|roerei|gekookt ei/, '🍳'],
  [/kaas/, '🧀'], [/kip|chicken|kalkoen|shoarma/, '🍗'], [/garnaal|scampi/, '🍤'], [/zalm|tonijn|haring|kibbeling|lekkerbek|makreel|\bvis\b|vissticks/, '🐟'],
  [/biefstuk|steak|gehakt|vlees|spek|bacon|\bham\b|rundvlees|varken|schnitzel|slavink|frikandel|kroket|bitterbal/, '🥩'],
  [/muesli|havermout|granola|cornflakes|ontbijtgranen|brinta|porridge|yoghurt|kwark|skyr|vla|pudding|griesmeel/, '🥣'],
  [/aardbei/, '🍓'], [/banaan/, '🍌'], [/sinaasappel|mandarijn|clementine/, '🍊'], [/citroen/, '🍋'], [/druif|druiven/, '🍇'], [/peer\b|peren/, '🍐'],
  [/ananas/, '🍍'], [/watermeloen|meloen/, '🍉'], [/kers/, '🍒'], [/perzik|nectarine/, '🍑'], [/mango/, '🥭'], [/kiwi/, '🥝'], [/avocado/, '🥑'],
  [/blauwe bes|bosbes|framboos|braam|\bbessen/, '🫐'], [/appel/, '🍎'], [/fruit/, '🍎'],
  [/tomaat/, '🍅'], [/wortel/, '🥕'], [/komkommer|augurk/, '🥒'], [/paprika/, '🫑'], [/mais\b|maïs/, '🌽'], [/champignon|paddenstoel/, '🍄'],
  [/aardappel|puree|stamppot|krieltjes/, '🥔'], [/broccoli|spinazie|boontjes|sperzie|groente|bloemkool|courgette|andijvie|boerenkool/, '🥦'],
  [/popcorn/, '🍿'], [/chips|pringles|zoutje/, '🥨'], [/noten|pinda|amandel|walnoot|cashew|hazelno/, '🥜'],
  [/chocola|snickers|\bmars\b|twix|bounty|kitkat|m&m/, '🍫'], [/snoep|drop|winegum|zuurtje|lolly/, '🍬'], [/donut/, '🍩'],
  [/\bijs\b|ijsje|softijs|magnum|sorbet/, '🍦'], [/taart|gebak|cake|muffin|cupcake|tompouce|appelflap|brownie/, '🍰'],
  [/koek|biscuit|stroopwafel|cookie|speculaas|ontbijtkoek|evergreen|sultana/, '🍪'], [/tofu|tempeh|falafel|hummus/, '🧆'], [/bonen|linzen|kikkererwt/, '🫘']
];
const MEAL_ICON = { ontbijt: '🥣', lunch: '🥪', diner: '🍽️', snack: '🍎' };
function foodIcon(e){
  const ai = String(e.icon || '').trim();
  if (ai && ai.length <= 8 && /\p{Extended_Pictographic}/u.test(ai)) return esc(ai);
  const text = (String(e.name || '') + ' ' + (e.items || []).map(i => i.name).join(' ')).toLowerCase();
  for (const [re, icon] of FOOD_ICONS) if (re.test(String(e.name || '').toLowerCase())) return icon;
  for (const [re, icon] of FOOD_ICONS) if (re.test(text)) return icon;
  return MEAL_ICON[e.meal] || '🍽️';
}
const macroLine = x => `eiwit ${r0(x.p)} · koolh. ${r0(x.c)} · vet ${r0(x.f)} g`;
/* The meal the add sheet starts on: the meal for this time of day, but a snack once that meal is already logged
   (a real meal of 200 kcal or more, not just a coffee). */
function logMeal(k){ const m = defaultMeal(); return k === todayKey() && m !== 'snack' && mealDone(k, m) ? 'snack' : m; }
function defaultMeal(){ const n = new Date(), h = n.getHours() + n.getMinutes() / 60;
  if (h < 10.5) return 'ontbijt'; if (h < 12) return 'snack'; if (h < 14.5) return 'lunch'; if (h >= 17 && h < 21) return 'diner'; return 'snack'; }

/* ---------- native bridge ---------- */
const Native = window.KnabbelNative || null;
let callSeq = 0; const pending = {};
window.__nativeResolve = (id, json) => {
  const p = pending[id]; if (!p) return; delete pending[id];
  let r; try { r = JSON.parse(json); } catch (e) { r = { ok: false, error: 'parse' }; }
  r.ok ? p.res(r.data) : p.rej(r.error);
};
function nat(method, args = {}){
  if (!Native) return Promise.reject('no-native');
  return new Promise((res, rej) => { const id = ++callSeq; pending[id] = { res, rej }; Native.call(id, method, JSON.stringify(args)); });
}
function openUrl(url){ if (Native) nat('app.openUrl', { url }).catch(() => {}); else window.open(url, '_blank'); }

/* ---------- state (stored on the phone) ---------- */
const S = {
  profile: null,
  meta: {
    weights: [], checkins: [], checkinSnooze: null, notifAt: 0,
    pet: { name: 'Knabbel', xp: 0, seeds: 25, owned: [], wear: { head: null, face: null, neck: null, hand: null, back: null, buddy: null } },
    fast: { start: null, goal: 16, log: [] },
    ai: { key: '', model: '', v: 2 },
    health: { on: false, pct: 50 }
  },
  days: {}
};
let view = 'today', dayKey = todayKey(), prevView = 'progress';
const LS = 'knabbel-v1';
/* Two copies: a real file in the app (included in Android's Google backup and phone-to-phone transfer)
   and the page's own storage as a fallback. On start the newest one wins. */
const fileStore = Native && typeof Native.storeLoad === 'function';
/* quiet: the automatic backup saving its own date, which must not start another backup. */
/* Every tap used to write everything to the phone (the whole state as text, twice). Now: 0.3 s after the last change,
   and at once when the app goes to the background or closes, so nothing is lost. dataVer counts the changes (for caches). */
let saveT = null, saveDirty = false, dataVer = 0;
function save(quiet){
  S.meta.savedAt = Date.now(); dataVer++; saveDirty = true;
  if (!quiet && typeof autoBackupSoon === 'function') autoBackupSoon();
  clearTimeout(saveT); saveT = setTimeout(flushSave, 300);
}
function flushSave(){
  clearTimeout(saveT); if (!saveDirty) return; saveDirty = false;
  // Today keeps the goal it has now; once it is a past day, that stays its goal (see goalOf).
  const T = S.profile && S.profile.targets, td = S.days[todayKey()];
  if (T && td && (!td.goal || td.goal.kcal !== T.kcal || td.goal.p !== T.p)) td.goal = { kcal: T.kcal, p: T.p };
  const txt = JSON.stringify(S);
  let ok = storeLocal(txt);
  if (fileStore) { try { ok = Native.storeSave(txt) || ok; } catch (e) {} }
  if (!ok) toast('Opslaan mislukt: het geheugen van de app is vol.');
}
addEventListener('pagehide', flushSave); addEventListener('freeze', flushSave);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
/* The browser keeps about 5 MB per site, a year of logging is about 0.7 MB. When it is full (after some years) the
   same data is stored packed (LZW, about 5 to 10 times smaller): nothing is thrown away, and reading unpacks it.
   The Android app also keeps everything in its own file, which has no such limit. */
const LZ_TAG = 'lz1:';
let lzOn = false;
/* Packing takes a moment (about a second on a phone with years of data), so once packed it is written 2 seconds after
   the last change, and right away when the app goes to the background. The Android app doesn't need the packed copy:
   its own file holds everything. */
let lzT = null, lzTxt = null;
function storeLocal(txt){
  if (!lzOn) { try { localStorage.setItem(LS, txt); return true; } catch (e) { lzOn = true; } }
  if (fileStore) { try { localStorage.removeItem(LS); } catch (e) {} return false; }
  lzTxt = txt; clearTimeout(lzT); lzT = setTimeout(lzFlush, 2000);
  return true;
}
function lzFlush(){
  clearTimeout(lzT); if (lzTxt == null) return;
  const txt = lzTxt; lzTxt = null;
  try { localStorage.setItem(LS, LZ_TAG + lzPack(txt)); } catch (e) { toast('Opslaan mislukt: het geheugen van de app is vol.'); }
}
addEventListener('pagehide', lzFlush);
document.addEventListener('visibilitychange', () => { if (document.hidden) lzFlush(); });
/* LZW over the UTF-8 bytes, 15-bit codes stored as one character each (never a surrogate), dictionary restarts when full. */
function lzPack(str){
  const bytes = new TextEncoder().encode(str), out = [];
  if (!bytes.length) return '';
  let dict = new Map(), next = 256, w = bytes[0];
  for (let i = 1; i < bytes.length; i++) {
    const b = bytes[i], c = dict.get(w * 256 + b);
    if (c !== undefined) { w = c; continue; }
    out.push(w + 256);
    if (next === 32768) { dict = new Map(); next = 256; } else dict.set(w * 256 + b, next++);
    w = b;
  }
  out.push(w + 256);
  let s = '';
  for (let i = 0; i < out.length; i += 8192) s += String.fromCharCode.apply(null, out.slice(i, i + 8192));
  return s;
}
function lzUnpack(s){
  if (!s.length) return '';
  let table = [], next = 256;
  const phrase = c => c < 256 ? [c] : table[c];
  let prev = phrase(s.charCodeAt(0) - 256);
  const parts = [prev];
  for (let i = 1; i < s.length; i++) {
    const c = s.charCodeAt(i) - 256;
    if (next === 32768) { table = []; next = 256; prev = phrase(c); parts.push(prev); continue; }
    const cur = c < 256 ? [c] : c < next ? table[c] : prev.concat(prev[0]);
    table[next++] = prev.concat(cur[0]);
    parts.push(cur); prev = cur;
  }
  const bytes = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0; for (const p of parts) { bytes.set(p, o); o += p.length; }
  return new TextDecoder().decode(bytes);
}
function readStores(){
  const parse = t => { try { return t ? JSON.parse(t) : null; } catch (e) { return null; } };
  let a = null, b = null;
  try { const raw = localStorage.getItem(LS); if (raw && raw.startsWith(LZ_TAG)) { lzOn = true; a = parse(lzUnpack(raw.slice(LZ_TAG.length))); } else a = parse(raw); } catch (e) {}
  if (fileStore) { try { b = parse(Native.storeLoad()); } catch (e) {} }
  if (a && b) return ((b.meta && b.meta.savedAt) || 0) >= ((a.meta && a.meta.savedAt) || 0) ? b : a;
  return b || a;
}
function load(){ applyData(readStores()); }
function applyData(x){
  try {
    if (x) { S.profile = x.profile || null; S.days = x.days || {};
      const m = x.meta || {};
      Object.assign(S.meta, m);
      S.meta.pet = Object.assign({}, { name: 'Knabbel', xp: 0, seeds: 25, owned: [], wear: {} }, m.pet || {});
      Object.entries(S.meta.pet.wear || {}).forEach(([slot, id]) => { const it = id && SHOP.find(i => i.id === id); if (it && it.slot !== slot) { S.meta.pet.wear[slot] = null; S.meta.pet.wear[it.slot] = id; } });
      S.meta.ai = Object.assign({ key: '', model: '' }, m.ai || {});
      if (S.meta.ai.v !== 2) { S.meta.ai.model = ''; S.meta.ai.v = 2; }
      S.meta.health = Object.assign({ on: false, pct: 50 }, m.health || {});
      S.meta.checkins ||= []; S.meta.weights ||= [];
      S.meta.fast = Object.assign({ start: null, goal: 16, log: [] }, m.fast || {});
      if (S.profile && S.profile.moveGoal === undefined) S.profile.moveGoal = 300;
      if (S.profile && !S.meta.waterAuto) { if (S.profile.water === 2000) S.profile.water = null; S.meta.waterAuto = 1; }
      if (S.meta.aiCache && !S.meta.sfCache) { S.meta.aiCache = {}; S.meta.sfCache = 1; }
      if (S.profile && S.profile.targets && S.profile.targets.fMin == null) S.profile.targets = calcTargets(S.profile);
    }
  } catch (e) {}
}
function day(k){ return S.days[k] || { entries: [], water: 0, flags: {} }; }
function ensureDay(k){ if (!S.days[k]) S.days[k] = { entries: [], water: 0, flags: {} }; S.days[k].flags ||= {}; S.days[k].entries ||= []; return S.days[k]; }
function totals(k){
  // Whole grams per meal, like each line shows them, so the rings are exactly the sum of what you see.
  return day(k).entries.reduce((a, e) => ({ kcal: a.kcal + (e.kcal || 0), p: a.p + r0(e.p), c: a.c + r0(e.c), f: a.f + r0(e.f),
    sf: a.sf + (e.sf || 0), sfUnknown: a.sfUnknown + (e.sf == null && !e.pending && (e.f || 0) >= 1 ? 1 : 0) }), { kcal: 0, p: 0, c: 0, f: 0, sf: 0, sfUnknown: 0 });
}

