/* Measuring the AI: per model and per task, kept as running numbers (no single questions are stored), and a score
   per model that decides which model gets a question. */

/* Per question to one model: the size of the photo, the upload, the time Google took (from the last byte sent to the
   first byte back), the total and the extra tries. geminiRaw fills meter.t, askModel counts the tries. */
const EMA = (old, v, a = 0.3) => old == null ? v : Math.round(old * (1 - a) + v * a);
const imgKB = image => image && image.data ? Math.round(image.data.length * 0.75 / 1024) : 0;
/* Questions with a photo, a recipe or ideas take longer by nature; a web search even more. */
const kindFactor = (kind, search) => search ? 3 : ['foto', 'etiket', 'recept', 'verbeter', 'ideeen', 'koelkast'].includes(kind) ? 1.8 : 1;

/* One model, one question done. Busy, too slow and a broken answer count as failed; a used-up limit, a bad key or
   a refused question say nothing about how good the model is, so they don't count. */
function noteModel(m, kind, res, meter, ms, image, search){
  // A dropped connection is about your network, not the model, so it doesn't count either.
  const ok = !!res.ok, failed = !ok && (res.busy || res.slowModel || (res.err && !['nosearch', 'network'].includes(res.err.code)));
  if (!ok && !failed) return;
  const A = S.meta.ai, M = (A.ms ||= {})[m] ||= { n: 0, ok: 0, last: '', k: {} };
  M.n++; if (ok) M.ok++;
  M.last = (M.last + (ok ? '1' : '0')).slice(-20);
  const t = meter.t;
  if (ok) {
    // Speed counts Google's own time when it was measured: your connection is not the model's fault.
    const speed = t && t.wait != null ? t.wait : ms, f = kindFactor(kind, search);
    M.ms = EMA(M.ms, speed / f);                                  // as if it were a plain question
    const K = M.k[kind + (search ? '+zoek' : '')] ||= { n: 0 };
    K.n++; K.ms = EMA(K.ms, speed);
  } else if (res.slowModel) M.ms = EMA(M.ms, ms / kindFactor(kind, search));
  M.at = Date.now();
}
/* One question done (answered or not), for the overview per task. */
function noteKind(kind, ok, ms, image, sends, meter){
  const A = S.meta.ai, K = (A.ks ||= {})[kind] ||= { n: 0, ok: 0, tries: 0 };
  K.n++; if (ok) K.ok++;
  K.tries += Math.max(0, sends - 1);
  if (ok) {
    K.ms = EMA(K.ms, ms);
    const t = meter && meter.t;
    if (t && t.up != null) K.up = EMA(K.up, t.up);
    if (t && t.wait != null) K.wait = EMA(K.wait, t.wait);
  }
  const kb = imgKB(image); if (kb) K.kb = EMA(K.kb, kb);
}

/* The model score, 0 to 100: speed 40%, success over the last 20 questions 40%, what's left of today's limit 20%.
   Speed: 2 seconds or faster is full marks, 20 seconds or slower none (longer for photos and searching). */
function speedOf(m, kind, search){
  const M = (S.meta.ai.ms || {})[m], K = M && M.k[kind + (search ? '+zoek' : '')];
  if (K && K.n >= 2) return K.ms;
  const plain = (M && M.ms) || (S.meta.ai.lat || {})[m] || UNTIMED_MS;
  return plain * kindFactor(kind, search);
}
function scoreParts(m, kind = 'eten', search = false){
  const M = (S.meta.ai.ms || {})[m], f = kindFactor(kind, search);
  const ms = speedOf(m, kind, search);
  const speed = clamp(100 * (1 - (ms - 2000 * f) / (18000 * f)), 0, 100);
  // Few questions yet: start from 80% so one bad moment doesn't push a model down for good.
  const last = (M && M.last) || '', hits = [...last].filter(c => c === '1').length;
  const success = 100 * (hits + 0.8 * 3) / (last.length + 3);
  let quota = 100 * leftToday(m) / Math.max(1, dayLimit(m));
  if (minuteFull(m)) quota *= 0.3;
  return { speed, success, quota, ms, total: 0.4 * speed + 0.4 * success + 0.2 * quota };
}
const modelScore = (m, kind, search) => Math.round(scoreParts(m, kind, search).total);
/* Which kind of model suits which task: photos (also of the fridge), labels and recipes need the full Flash models (they
   read and reason better). Questions to Knabbel, ideas and searching the web lean to Lite: it has hundreds a day, so
   the 20 Flash questions a day stay for the photos. The lean is 8 points, so a Lite model that is clearly slower or
   fails more still loses (speed and success are 80% of the score). Typed meals and "Kan dit?" simply go to the best
   score. Previews are a little less reliable. */
const TASK_LITE = { foto: -15, etiket: -15, koelkast: -15, recept: -10, verbeter: -10, ideeen: 8, vraag: 8, opzoeken: 10 };
function taskScore(m, kind, search){
  let s = scoreParts(m, kind, search).total;
  if (isLite(m)) s += TASK_LITE[kind] ?? (search ? 10 : 0);
  if (/preview|exp/.test(m)) s -= 5;
  return s;
}

/* Settings: the score per model, and per task how long it takes and which model it goes to now. */
function aiScoresHTML(){
  const A = S.meta.ai, ms = A.ms || {}, ks = A.ks || {};
  const models = (A.models || []).filter(textModel).filter(m => ms[m] || usedToday(m));
  if (!models.length && !Object.keys(ks).length) return '';
  const sec = v => String(r1(v / 1000)).replace('.', ',');
  const short = m => esc(m.replace(/^gemini-/, ''));
  const rows = models.map(m => [m, scoreParts(m)]).sort((a, b) => b[1].total - a[1].total).map(([m, p]) => {
    const M = ms[m], last = (M && M.last) || '';
    return `<div class="eq"><span>${short(m)}<br><span class="note">${last.length ? `${Math.round(100 * [...last].filter(c => c === '1').length / last.length)}% gelukt · ` : ''}${M && M.ms ? `± ${sec(M.ms)} s · ` : ''}${leftToday(m)}/${dayLimit(m)} over</span></span><b class="num">${Math.round(p.total)}</b></div>`;
  }).join('');
  const all = (A.models || []).filter(textModel).filter(m => !isGone(m));
  const now = k => { const q = all.length ? aiQueue(all, k, k === 'opzoeken') : []; return q[0] ? ` · nu ${short(q[0])}` : ''; };
  const kinds = Object.entries(ks).sort((a, b) => b[1].n - a[1].n).map(([k, K]) => {
    const bits = [`${K.n}×`, K.n - K.ok ? `${K.n - K.ok} mislukt` : '', K.ms ? `totaal ${sec(K.ms)} s` : '', K.up != null ? `upload ${sec(K.up)} s` : '', K.wait != null ? `Gemini ${sec(K.wait)} s` : '',
      K.kb ? `foto ${K.kb} KB` : '', K.n ? `${String(r1(K.tries / K.n)).replace('.', ',')} extra ${r1(K.tries / K.n) === 1 ? 'poging' : 'pogingen'}` : ''].filter(Boolean);
    return `<p class="note"><b>${AI_KIND[k] || esc(k)}</b>${AI_BG.has(k) ? '' : now(k)}<br>${bits.join(' · ')}</p>`;
  }).join('');
  return `<details class="more-rows aiscores"><summary>Modelscores en metingen ›</summary><div>
    ${rows ? `<div class="card eqs">${rows}</div>
    <p class="note">Score van 0 tot 100: snelheid 40%, gelukt bij de laatste 20 vragen 40%, wat er vandaag nog over is 20%. Foto's, etiketten en recepten gaan liever naar een volledig Flash-model, opzoeken liever naar Lite.</p>` : ''}
    ${kinds ? `<div class="card" style="gap:8px">${kinds}</div><p class="note">Gemiddelden van de laatste vragen. Upload is het versturen (met je foto), Gemini de tijd tot Google begint te antwoorden.</p>` : ''}
  </div></details>`;
}
