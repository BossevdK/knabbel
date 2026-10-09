/* The shell: pages, navigation and sheets. */
/* ---------- shell ---------- */
const ICON = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>',
  advice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>',
  add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16M7 16v-5M12 16V6M17 16v-8"/></svg>',
  pet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9 L4 3.5 L9 6 M19 9 L20 3.5 L15 6"/><path d="M12 5.5 C17 5.5 20 8.5 20.5 12 L22 13.5 L20 14.5 C18.5 18 15.5 19.5 12 19.5 C8.5 19.5 5.5 18 4 14.5 L2 13.5 L3.5 12 C4 8.5 7 5.5 12 5.5 Z"/><circle cx="9" cy="12" r=".6" fill="currentColor"/><circle cx="15" cy="12" r=".6" fill="currentColor"/></svg>',
  gear: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>'
};
function renderNav(){
  const n = $('#nav'); n.hidden = !S.profile;
  const b = (id, label) => `<button data-nav="${id}" ${view === id ? 'aria-current="page"' : ''}>${ICON[id]}<span>${label}</span></button>`;
  n.innerHTML = `<div class="in">${b('today','Vandaag')}${b('advice','Kiezen')}<button class="fab" data-act="open-log" aria-label="Eten toevoegen">${ICON.add}</button>${b('progress','Voortgang')}${b('pet', esc(S.meta.pet.name).slice(0, 10))}</div>`;
}
/* A new page fades in and moves up 8px; another day slides in from the side it comes from. */
let shownView = null, shownDay = null, shownPetTab = null;
function pageMotion(){
  const app = $('#app'), first = shownView === null;
  const how = shownView !== view || (view === 'pet' && shownPetTab !== petTab) ? 'page-in'
    : view === 'today' && shownDay !== dayKey ? (dayKey > shownDay ? 'from-r' : 'from-l') : '';
  shownView = view; shownDay = dayKey; shownPetTab = petTab;
  if (!how || first || reduceMotion()) return;
  app.classList.remove('page-in', 'from-r', 'from-l'); void app.offsetWidth; app.classList.add(how);
  clearTimeout(pageMotion.t); pageMotion.t = setTimeout(() => app.classList.remove(how), 700);
}
/* The big number in the ring counts to its new value in 0.4 s instead of jumping. The page is often drawn
   twice in a row after a change; a count that is already running just carries on in the new number. */
let shownRing = null;
const ringAt = (A, now) => A.from + (A.to - A.from) * (1 - (1 - Math.min(1, (now - A.t0) / 400)) ** 3);
function countRing(){
  const el = document.querySelector('.ringnum .big'); if (!el) return;
  const n = Number(el.textContent.replace(/[^0-9]/g, '')), key = dayKey + '|' + (S.meta.ringMode || 'left') + '|' + (el.nextElementSibling ? el.nextElementSibling.textContent : '');
  const R = shownRing && shownRing.key === key ? shownRing : null, now = performance.now();
  const running = R && R.anim && now - R.anim.t0 < 400;
  if (running && R.anim.to === n) { countStep(el, R.anim); return; }
  const from = running ? ringAt(R.anim, now) : R && R.n !== n ? R.n : null;
  shownRing = { key, n, anim: null };
  if (from == null || reduceMotion()) return;
  shownRing.anim = { from, to: n, t0: now }; countStep(el, shownRing.anim);
}
function countStep(el, A){
  el.textContent = Math.round(ringAt(A, performance.now()));
  const step = t => { if (!el.isConnected) return; el.textContent = Math.round(ringAt(A, t)); if (t - A.t0 < 400) requestAnimationFrame(step); };
  requestAnimationFrame(step);
  // Safety net: frames pause while the app is in the background, so the right number is always set at the end.
  setTimeout(() => { if (el.isConnected) el.textContent = A.to; }, Math.max(0, 420 - (performance.now() - A.t0)));
}
/* The flame flickers once when your streak goes up. */
let shownStreak = null;
function flareStreak(){
  if (!S.profile) return;
  const n = streak(), el = document.querySelector('.streakpill');
  if (shownStreak != null && n > shownStreak && el && !reduceMotion()) el.classList.add('flare');
  shownStreak = n;
}
/* A deleted or undone meal folds shut (0.2 s) before the list is drawn again. */
function collapseThen(ids, fn){
  const els = ids.map(id => document.querySelector(`[data-edit="${id}"]`)).filter(Boolean);
  if (!els.length || reduceMotion()) { fn(); return; }
  els.forEach(el => { el.style.overflow = 'hidden'; el.animate([{ height: el.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px' }], { duration: 200, easing: 'ease-in', fill: 'forwards' }); });
  setTimeout(fn, 200);
}
/* A water glass that just got full: its tick pops. */
function popNewCups(before){
  document.querySelectorAll('.cup.full').forEach((c, i) => { if (i >= before) c.classList.add('just'); });
}
/* Before the page is drawn again: remember where each ring is right now (it may still be moving),
   so the new ring carries on from there instead of jumping to its end. */
function captureMotion(){
  document.querySelectorAll('circle[data-mk]').forEach(el => { const v = parseFloat(getComputedStyle(el).strokeDashoffset); if (!isNaN(v)) motionPrev[el.dataset.mk] = v; });
  Object.entries(sweepLive).forEach(([k, p]) => { motionPrev[k + 'f'] = p; });
}
function render(){
  // A field removed while focused never sends focusout, so the tab bar could stay hidden.
  if (!typingField(document.activeElement)) document.body.classList.remove('typing');
  renderNav();
  const app = $('#app');
  if (!S.profile) { app.innerHTML = profileHTML(); return; }
  captureMotion();
  app.innerHTML = ({ today: todayHTML, advice: adviceHTML, progress: progressHTML, pet: petHTML, settings: settingsHTML, profile: profileHTML })[view]();
  tickFast();
  pageMotion();
  const pt = document.querySelector('.pettabs'); if (pt) document.documentElement.style.setProperty('--pettabs-h', pt.offsetHeight + 'px');
  animateIn();
  countRing();
  flareStreak();
  wakePets();
  document.documentElement.dataset.tod = timeOfDay();
  setTimeout(checkBadges, 0);
  setTimeout(() => kiloParty(), 300);
  // Sunflower seeds went up: a little pop on the counter.
  if (seedsShown != null && S.meta.pet.seeds > seedsShown) document.querySelectorAll('.seedpill').forEach(el => el.classList.add('pop'));
  seedsShown = S.meta.pet.seeds;
}
/* The panda moves only while it is on screen and the app is in view; then it now and then does something by itself. */
let petObserver = null, petActT = null, pokeTaps = [];
function wakePets(){
  if (petObserver) petObserver.disconnect();
  const pets = document.querySelectorAll('.pet[data-alive]'), deco = document.querySelectorAll('.shop button, .flame');
  if ((!pets.length && !deco.length) || reduceMotion()) return;
  petObserver = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('alive', e.isIntersecting && !document.hidden)), { threshold: .3 }) : null;
  [...pets, ...deco].forEach(el => petObserver ? petObserver.observe(el) : el.classList.add('alive'));
  clearTimeout(petActT); if (pets.length) petAct();
}
function petAct(){
  petActT = setTimeout(() => {
    const el = document.querySelector('.pet.alive');
    if (el && !sheetOpen()) { const h = new Date().getHours(), late = h >= 22 || h < 8;
      const mood = petMood();
      const acts = FL('alive')
        ? ['jump', 'wave', 'peek', 'peek', 'sniff', 'sniff', 'look', 'scratch', 'stretch', 'wiggle', 'tilt', 'wag',
           ...(late || mood === 'sleepy' ? ['yawn', 'doze', 'doze', 'yawn'] : ['yawn']), ...(mood === 'hungry' || mood === 'starving' ? ['rub', 'rub', 'sniff'] : []), ...(mood === 'full' || mood === 'stuffed' ? ['rub', 'wiggle'] : [])]
        : ['hop', 'wag', 'spin', 'wave', 'look', 'look', 'stretch', 'tilt', 'wave', 'wag', ...(late || mood === 'sleepy' ? ['yawn', 'yawn', 'yawn'] : ['yawn'])];
      petDo(el, acts[Math.floor(Math.random() * acts.length)]); }
    if (document.querySelector('.pet[data-alive]')) petAct();
  }, FL('alive') ? 6000 + Math.random() * 6000 : 9000 + Math.random() * 7000);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) document.querySelectorAll('.alive').forEach(el => el.classList.remove('alive')); else wakePets(); });
let seedsShown = null;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/* A short burst of confetti for goals, level-ups and purchases. */
function confetti(n = 28){
  if (reduceMotion()) return;
  const cols = ['var(--accent)', 'var(--leaf)', 'var(--c)', 'var(--f)', 'var(--sky)'];
  const el = document.createElement('div'); el.className = 'confetti'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = Array.from({ length: n }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${cols[i % 5]};animation-delay:${(Math.random() * .3).toFixed(2)}s;--dx:${Math.round((Math.random() - .5) * 140)}px;--r:${Math.round(Math.random() * 720 - 360)}deg"></i>`).join('');
  document.body.appendChild(el); setTimeout(() => el.remove(), 2200);
}
/* Restart a CSS animation class on an element. */
function replay(el, cls){ if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
/* One of Knabbel's little moves; the class goes away afterwards so his normal blinking and breathing carry on. */
function petDo(el, cls){ if (!el || reduceMotion()) return; replay(el, cls); setTimeout(() => el.classList.remove(cls), 2300); }
/* A little dance when you reach a goal or a new level (only when he is on screen). */
function petDance(){
  const el = [...document.querySelectorAll('.pet[data-alive]')].find(p => { const r = p.getBoundingClientRect(); return r.width && r.bottom > 40 && r.top < innerHeight - 60; });
  if (el) { petDo(el, 'dance'); petDo(el, 'wave'); }
}
const sheetOpen = () => !!$('#sheetRoot .scrim:not(.closing)');

