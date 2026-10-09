/* AI (Google Gemini): models, quota, asking, and scores for meals in the background. */
/* ---------- AI (Google Gemini, free tier) ---------- */
function looseJSON(text){
  const t = String(text || '').trim();
  try { return JSON.parse(t); } catch (e) {}
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/); if (fence) { try { return JSON.parse(fence[1]); } catch (e) {} }
  const a = t.search(/[\[{]/), b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
  throw { code: 'invalid_json' };
}
/* Show what the AI is doing inside whichever "thinking" box is on screen. */
function aiStatus(text){ const el = document.getElementById('aiStatus'); if (el) el.textContent = text; }
/* Thinking makes newer models slow; a calorie estimate doesn't need it. 3.x gets the lowest thinking level it
   accepts ("minimal", else "low"), 2.5 Flash a thinking budget of 0. A model that refuses a setting steps down once
   and remembers that. The output is capped so a runaway answer can't keep you waiting. */
const THINK_STEPS = ['minimal', 'low', 'off'];
function thinkStep(model){
  const v = parseFloat((model.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  if (v < 2.5 || (v < 3 && /pro/.test(model))) return 'off';
  return (S.meta.ai.think || {})[model] || (v >= 3.7 && !/lite/.test(model) ? 'low' : v >= 3 ? 'minimal' : 'budget0');
}
function genConfig(model, step, schema, temp = 0, search = false, media = null){
  const g = { maxOutputTokens: 4096 };
  // Temperature: 0 on the 2.5 models (same food, same answer; ideas may vary). Gemini 3 doesn't take a temperature any
  // more (deprecated by Google in July 2026): the same answer for the same text comes from the prompt, the NEVO table
  // and the remembered answers instead.
  if (modelVer(model) < 3) g.temperature = temp;
  // Photos on Gemini 3: medium resolution (560 instead of 1120 tokens per photo, so it starts answering sooner).
  // Labels keep the full resolution for the small print (see askOne).
  if (media) g.mediaResolution = media;
  // With Google Search the model may not be held to strict JSON; the answer is then read from its text.
  if (!search) g.responseMimeType = 'application/json';
  if (schema && !search && !(S.meta.ai.noSchema || {})[model]) g.responseSchema = schema;
  if (step === 'minimal' || step === 'low') g.thinkingConfig = { thinkingLevel: step };
  else if (step === 'budget0') g.thinkingConfig = { thinkingBudget: 0 };
  return g;
}
async function geminiRaw(model, key, prompt, step, schema, temp, image, search, meter){
  const parts = [{ text: prompt }]; if (image) parts.push({ inline_data: { mime_type: image.mime, data: image.data } });
  const req = { contents: [{ role: 'user', parts }], generationConfig: genConfig(model, step, schema, temp, search, image && meter ? meter.media : null) };
  if (search) req.tools = [{ google_search: {} }];
  const body = JSON.stringify(req);
  // Straight from the page, also in the app: the browser keeps the connection to Google open (HTTP/2), so a question
  // doesn't have to set up a new secure connection first. Only when that fails does the app's own connection take over.
  // XMLHttpRequest instead of fetch: it tells when the question (with the photo) is fully sent, so the upload and the
  // time Google takes can be measured apart. A long answer (ideas) streams in: the parts arrive while Google writes.
  const stream = !!(meter && meter.onText) && !search;
  try { return await xhrPost(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`, key, body, meter, stream); }
  catch (e) {
    if (!Native || (e && e.code === 'aborted')) throw e;
    // The app's own connection can't be stopped from here, so it gets only the time this model has left.
    const r = await nat('ai.gemini', { key, model, body, timeout: meter && meter.left ? clamp(Math.round(meter.left()), 3000, 40000) : 40000 });
    if (meter && r.t) meter.t = r.t;
    return r;
  }
}
/* t.up: from sending until the last byte left the phone; t.wait: from then until the first byte of the answer
   (Google working); t.down: receiving the answer. */
/* A streamed answer comes as "data: {...}" pieces, each with a bit of the text. They are glued together, shown as they
   come (meter.onText), and at the end handed on as one ordinary answer, so everything after this works the same. */
function sseRead(st, txt){
  const parts = txt.slice(st.pos).split(/\r?\n\r?\n/); parts.pop();   // the last piece may still be incomplete
  for (const ev of parts) {
    st.pos += ev.length; const m = txt.slice(st.pos).match(/^\r?\n\r?\n/); if (m) st.pos += m[0].length;
    const line = ev.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('');
    if (!line) continue;
    let j; try { j = JSON.parse(line); } catch (e) { continue; }
    const c = j.candidates && j.candidates[0];
    if (c) {
      st.text += ((c.content && c.content.parts) || []).map(p => p.thought ? '' : (p.text || '')).join('');
      if (c.finishReason) st.finish = c.finishReason;
      if (c.groundingMetadata) st.grounding = c.groundingMetadata;
    }
    if (j.promptFeedback) st.feedback = j.promptFeedback;
  }
}
function xhrPost(url, key, body, meter, stream){
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest(), t0 = performance.now(), st = { pos: 0, text: '', shown: 0 };
    let tUp = 0, tHead = 0;
    // Kept, so a request that is no longer needed (too slow, or another model answered) can be stopped: it then stops
    // using data. Google may still count it towards the limit.
    if (meter) { meter.xhr = x; if (meter.live) meter.live.add(x); }
    x.onloadend = () => { if (meter && meter.live) meter.live.delete(x); };
    x.onabort = () => rej({ code: 'aborted' });
    x.open('POST', url);
    x.setRequestHeader('Content-Type', 'application/json');
    x.setRequestHeader('x-goog-api-key', key);
    x.upload.onload = () => { tUp = performance.now(); };
    x.onreadystatechange = () => { if (x.readyState === 2 && !tHead) tHead = performance.now(); };
    if (stream) x.onprogress = () => {
      if (x.status !== 200) return;
      if (meter) meter.streaming = true;   // text is coming in: this model is not "too slow" (see askOne)
      sseRead(st, x.responseText);
      if (st.text.length > st.shown) { st.shown = st.text.length; try { meter.onText(st.text); } catch (e) {} }
    };
    x.onload = () => {
      const tEnd = performance.now(); if (!tHead) tHead = tEnd;
      if (meter) meter.t = tUp ? { up: Math.round(tUp - t0), wait: Math.round(tHead - tUp), down: Math.round(tEnd - tHead) } : { up: null, wait: null, down: Math.round(tEnd - tHead) };
      if (!stream || x.status !== 200) return res({ status: x.status, body: x.responseText });
      sseRead(st, x.responseText + '\n\n');
      const cand = { content: { parts: [{ text: st.text }] }, finishReason: st.finish || 'STOP' };
      if (st.grounding) cand.groundingMetadata = st.grounding;
      res({ status: 200, body: JSON.stringify(st.text || !st.feedback ? { candidates: [cand] } : { promptFeedback: st.feedback }) });
    };
    x.onerror = () => rej(new TypeError('Failed to fetch'));
    x.send(body);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errMsg = body => { try { return JSON.parse(body).error.message || ''; } catch (e) { return ''; } };
/* Rank the text models this key may use: newest stable Flash first, Lite and previews as fallbacks. */
/* Only the ordinary text models: "gemini-<version>-flash…". Left out:
   - other families without a version number right after "gemini-", like gemini-omni-…-flash: that is a video model
     (paid only), which answers a food question with a limit error or after half a minute, if at all;
   - tts, live, image, audio and the like: they don't write text;
   - the 2.0 models (no free requests at all), and the "-latest" names: those point to one of the other models and
     share its limit, so they would only make the count per model wrong. */
const textModel = n => /^gemini-\d+(\.\d+)?-flash/.test(n) && modelVer(n) >= 2.5 && !/latest/.test(n)
  && !/(omni|tts|live|image|audio|video|embed|transcri|translat|robotic|computer|native|thinking)/.test(n);
function rankModels(list){
  const names = (list || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => String(m.name || '').replace(/^models\//, ''))
    .filter(textModel);
  const score = n => {
    const v = parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
    let s = v ? v * 10 : 20;
    if (/lite/.test(n)) s -= 15;
    if (/preview|exp/.test(n)) s -= 8;
    if (/-\d{3}$/.test(n)) s -= 1;
    return s;
  };
  return names.sort((a, b) => score(b) - score(a));
}
async function modelList(key, force){
  const A = S.meta.ai;
  // A list saved by an older version may still hold 2.0, "-latest" or omni (video) names: left out the same way.
  if (!force && A.models && A.models.length && Date.now() - (A.modelsAt || 0) < 3 * 864e5) {
    const ok = A.models.filter(textModel);
    if (ok.length) return ok;
  }
  let r;
  try {
    r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } }).then(async x => ({ status: x.status, body: await x.text() }))
      .catch(e => { if (Native) return nat('ai.models', { key }); throw e; });
  } catch (e) { throw { code: 'network' }; }
  if (r.status === 400 || r.status === 401 || r.status === 403) throw { code: 'bad_key' };
  if (r.status >= 300) return A.models && A.models.length ? A.models : ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  let j; try { j = JSON.parse(r.body); } catch (e) { j = {}; }
  const ranked = rankModels(j.models);
  if (ranked.length) { A.models = ranked; A.modelsAt = Date.now(); save(); }
  return ranked.length ? ranked : ['gemini-flash-latest'];
}
/* Free-tier quotas are per model. A daily limit resets at midnight Pacific time (09:00 in the Netherlands),
   a per-minute limit after a minute. Until then that model goes to the back of the line. */
function nextQuotaReset(){
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date()).map(x => [x.type, x.value]));
    const since = ((+parts.hour % 24) * 3600 + +parts.minute * 60 + +parts.second) * 1000;
    return Date.now() + 864e5 - since + 60000;
  } catch (e) { const t = new Date(); t.setHours(24, 5, 0, 0); return t.getTime(); }
}
function coolDown(model, body){
  const perDay = /per[ _]?day|PerDay|daily/i.test(body || '');
  S.meta.ai.cool = Object.assign({}, S.meta.ai.cool, { [model]: perDay ? nextQuotaReset() : Date.now() + retryMs(body) });
  learnQuota(model, body);
  if (perDay) { const U = aiUse(); U.n[model] = Math.max(U.n[model] || 0, dayLimit(model)); }
  save();
}
const isCool = m => (S.meta.ai.cool || {})[m] > Date.now();
/* How long Google says to wait before asking again (RetryInfo in a 429, e.g. "37s"), else a minute. */
function retryMs(body){
  try { const d = (JSON.parse(body).error.details || []).find(x => /RetryInfo/.test(x['@type'] || '')), s = parseFloat(String(d && d.retryDelay || ''));
    if (s > 0) return clamp(Math.round(s * 1000) + 1000, 5000, 120000); } catch (e) {}
  return 65000;
}
/* A limit of 0: this model isn't open to this key at all (switched off, or not on the free tier). */
const zeroQuota = body => /limit:\s*0\b|"quotaValue":\s*"0"/.test(String(body || ''));
/* Searching the web: on the free tier only the 2.5 models may use Google Search (Gemini 3: "not available", Google's
   price list, October 2026). A key that is clearly paid (Google reported a higher day limit) may search with any model.
   A model that refused searching is skipped for it (for good when it can't, until a time after a limit). */
const paidKey = () => Object.entries(S.meta.ai.lim || {}).some(([m, v]) => v > freeLimit(m)[1]);
/* Gemini 3 on a free key: Google says searching is not available, but that may change. So once a day one model gets a
   test question; a model that did search once keeps doing it. That costs at most one request a day. */
const searchProbeDue = () => Date.now() - (S.meta.ai.searchProbe || 0) > 864e5;
const searchOk = m => { const v = (S.meta.ai.noSearch || {})[m]; if (v === 1 || v > Date.now()) return false;
  return modelVer(m) < 3 || paidKey() || !!(S.meta.ai.searchYes || {})[m] || searchProbeDue(); };
const isProbe = m => modelVer(m) >= 3 && !paidKey() && !(S.meta.ai.searchYes || {})[m];
/* Can anything search right now? If not, nothing is looked up (and no request is spent on it): the AI's estimate or
   the close NEVO product simply stays. */
const canSearch = () => !(S.meta.ai.searchCool > Date.now()) && (S.meta.ai.models || []).filter(textModel).some(m => !isGone(m) && !isCool(m) && leftToday(m) > 0 && searchOk(m));
/* The free tier (AI Studio, October 2026) allows per model, for the whole project: full Flash models 5 requests a
   minute and 20 a day, Flash-Lite 15 a minute and 500 a day. Failed requests (busy, limit) count too. So the app counts
   what it sends: the scarce Flash requests go to your own questions, background work and searching go to Lite, and a
   model whose day is used up isn't asked any more until the reset (09:00 in the Netherlands). A limit Google reports in
   a 429 replaces the guess; a model that keeps answering past the guess (a paid key) raises it. */
const isLite = m => /lite/.test(m);
const modelVer = m => parseFloat((m.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
/* Free-tier limits per model as AI Studio shows them (October 2026): [per minute, per day].
   Flash-Lite 3.x 15 / 500 · Flash-Lite 2.5 10 / 20 · Flash 2.5 and newer 5 / 20 · 2.0 models 0 (not on the free tier). */
function freeLimit(m){
  const v = modelVer(m);
  if (v && v < 2.5) return [0, 0];
  if (isLite(m)) return v >= 3 ? [15, 500] : [10, 20];
  return [5, 20];
}
const quotaDay = () => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date()); } catch (e) { return todayKey(); } };
function aiUse(){ const A = S.meta.ai, d = quotaDay(); if (!A.use || A.use.day !== d) A.use = { day: d, n: {} }; return A.use; }
const dayLimit = m => (S.meta.ai.lim || {})[m] || freeLimit(m)[1];
const minuteLimit = m => (S.meta.ai.lim || {})[m] > freeLimit(m)[1] ? 1000 : freeLimit(m)[0];
/* Plenty of room (hundreds a day): background work and searching go there. The rest is scarce and kept for you. */
const roomy = m => dayLimit(m) >= 100;
const usedToday = m => aiUse().n[m] || 0;
const leftToday = m => Math.max(0, dayLimit(m) - usedToday(m));
const aiSent = {};                                                   // model → send times in the last minute
const minuteFull = m => (aiSent[m] = (aiSent[m] || []).filter(t => t > Date.now() - 60000)).length >= minuteLimit(m);
function countSend(m){ const U = aiUse(); U.n[m] = (U.n[m] || 0) + 1; (aiSent[m] ||= []).push(Date.now()); }
function learnQuota(m, body){
  try {
    (JSON.parse(body).error.details || []).forEach(x => (x.violations || []).forEach(v => {
      const val = Number(v.quotaValue);
      if (val > 0 && /per[ _]?day|PerDay/i.test(`${v.quotaId || ''} ${v.quotaMetric || ''}`)) S.meta.ai.lim = Object.assign({}, S.meta.ai.lim, { [m]: val });
    }));
  } catch (e) {}
}
/* Busy (503) right now: that model waits 3 minutes, so the next question doesn't start with a request that fails.
   Not found (404): skipped for a week (Google sometimes still lists a model that no longer answers). */
const aiBusy = {};
const isGone = m => (S.meta.ai.gone || {})[m] > Date.now();
/* One model, one question: steps down the thinking setting if the model refuses it, retries once when Google
   is busy. Answers { ok, value } or tells the caller what went wrong. */
/* How long one model may take before the next one gets the question: 2,5× what it usually takes for you (a photo,
   ideas or a web search take longer), between 12 and 25 seconds (35 when searching). Before, one slow model could
   use the whole minute and the question failed without any other model being asked. The last model in line gets
   all the time that is left. */
function modelCap(m, kind, image, search){
  const l = (S.meta.ai.lat || {})[m] || UNTIMED_MS, heavy = !!image || ['foto', 'recept', 'verbeter', 'ideeen', 'koelkast'].includes(kind);
  const f = search ? 3 : heavy ? 1.8 : 1;
  return clamp(Math.round(l * f * 2.5), heavy || search ? 18000 : 12000, search ? 35000 : 25000);
}
async function askModel(m, key, prompt, left0, canRetry, schema, temp, image, search, kind, live, onText){
  const meter = { sends: 0, t: null, live, onText }, t1 = Date.now();
  const res = await askOne(m, key, prompt, left0, canRetry, schema, temp, image, search, kind, meter);
  noteModel(m, kind, res, meter, Date.now() - t1, image, search);
  res.meter = meter;
  return res;
}
/* Rejects with "slow" when this model's time is up. A model whose answer is streaming in gets the whole time of the
   question instead (it is clearly working, just writing a long answer). */
function slowTimer(meter, left, left0){
  let t = null;
  const p = new Promise((_, rej) => {
    const tick = () => { const ms = meter.streaming ? left0() : left(); if (ms <= 0) rej({ code: 'slow' }); else t = setTimeout(tick, Math.min(ms, 1000)); };
    t = setTimeout(tick, 1000);
  });
  p.stop = () => clearTimeout(t);   // the answer is in: no more ticking
  return p;
}
async function askOne(m, key, prompt, left0, canRetry, schema, temp, image, search, kind, meter){
  let step = thinkStep(m), r, plainTried = false;
  const capMs = canRetry ? Infinity : modelCap(m, kind, image, search), until = Date.now() + capMs;
  const left = () => Math.min(left0(), until - Date.now());
  // This model gave an internal error (500) with the schema and thinking settings before, and answered without them.
  // (Gemini 3 keeps "low": without any thinking setting it thinks at medium or high, which is slower.)
  if ((S.meta.ai.plain || {})[m]) { schema = null; step = modelVer(m) >= 3 ? 'low' : 'off'; }
  if (search && !searchOk(m)) return { err: { code: 'nosearch' } };
  let useSearch = !!search && !(S.meta.ai.searchCool > Date.now());
  if (useSearch && isProbe(m)) { S.meta.ai.searchProbe = Date.now(); save(); }   // today's one test
  // A meal or fridge photo on a Gemini 3 model: medium resolution. Labels keep the full resolution (small print).
  meter.media = image && kind !== 'etiket' && modelVer(m) >= 3 && !(S.meta.ai.noMedia || {})[m] ? 'MEDIA_RESOLUTION_MEDIUM' : null;
  let blip = false; meter.left = left;
  for (let attempt = 0; attempt < 6; attempt++) {
    countSend(m); meter.sends++;
    const hidden0 = document.hidden;
    try {
      const timer = slowTimer(meter, left, left0);
      r = await Promise.race([geminiRaw(m, key, prompt, step, schema, temp, image, useSearch, meter), timer]).finally(timer.stop);
    } catch (e) {
      if (e && e.code === 'aborted') return { aborted: true };
      // Too slow: stop this request (it would keep using data), then the next model takes over while there is time.
      if (e && e.code === 'slow' && meter.xhr) meter.xhr.abort();
      if (e && e.code === 'slow') return left0() > 3000 && capMs !== Infinity ? { slowModel: true, err: { code: 'slow', msg: `gaf na ${Math.round(capMs / 1000)} s nog geen antwoord, volgende model gevraagd` } } : { fatal: e };
      // Really offline: stop. Otherwise the connection dropped for a moment (switching wifi/4G, or the iPhone paused
      // the app while you looked elsewhere): once more on the same model after a short wait, then the next model.
      if (navigator.onLine === false) return { fatal: { code: 'network' } };
      if (!blip && left() > 5000) { blip = true; await sleep(hidden0 || document.hidden ? 300 : 1500); continue; }
      return { err: { code: 'network', msg: `verbinding viel weg (${String((e && e.message) || e || '').slice(0, 60)})` } };
    }
    // Searching not possible with this model: remember that, so the next model is asked instead.
    if (useSearch && r.status === 400 && /search|tool|ground|mime|json/i.test(errMsg(r.body))) {
      S.meta.ai.noSearch = Object.assign({}, S.meta.ai.noSearch, { [m]: modelVer(m) >= 3 ? Date.now() + 7 * 864e5 : 1 }); save(); return { err: { code: 'nosearch' } };
    }
    // Free search quota used up (the message is about search/grounding): searching pauses (a minute, or until the
    // daily reset). Any other limit is this model's own: then the next model gets the question (handled below).
    // The search quota itself used up (the message is about search/grounding): searching pauses. Any other limit is
    // this model's own (20 a day on the free tier): that is handled below, and a Lite model can take over.
    if (useSearch && r.status === 429 && /ground|search/i.test(errMsg(r.body) || '')) {
      S.meta.ai.searchCool = /per[ _]?day|PerDay|daily/i.test(r.body || '') ? nextQuotaReset() : Date.now() + retryMs(r.body); save();
      return { fatal: { code: 'search_off', msg: errMsg(r.body) || String(r.body || '').slice(0, 200) } };
    }
    // Any other limit while searching is about searching with this model (on the free tier Gemini 3 can't search at
    // all: "limit 0"). Only searching with this model pauses; the model itself stays free for ordinary questions.
    // Before, this paused the whole model, sometimes for the rest of the day.
    if (useSearch && r.status === 429) {
      const until = zeroQuota(r.body) ? Date.now() + 3 * 864e5 : /per[ _]?day|PerDay|daily/i.test(r.body || '') ? nextQuotaReset() : Date.now() + retryMs(r.body);
      S.meta.ai.noSearch = Object.assign({}, S.meta.ai.noSearch, { [m]: until }); save();
      return { err: { code: 'nosearch', msg: errMsg(r.body) } };
    }
    // The model doesn't accept the photo resolution setting: remembered, and asked again without it.
    if (r.status === 400 && meter.media && /media|resolution/i.test(errMsg(r.body))) {
      S.meta.ai.noMedia = Object.assign({}, S.meta.ai.noMedia, { [m]: 1 }); meter.media = null; save(); continue;
    }
    if (r.status === 400 && schema && !(S.meta.ai.noSchema || {})[m] && /schema|response_?schema|responseSchema/i.test(errMsg(r.body))) {
      S.meta.ai.noSchema = Object.assign({}, S.meta.ai.noSchema, { [m]: 1 }); save(); continue;
    }
    if (r.status === 400 && step !== 'off' && /think/i.test(errMsg(r.body))) {
      step = step === 'budget0' ? 'off' : THINK_STEPS[THINK_STEPS.indexOf(step) + 1] || 'off';
      S.meta.ai.think = Object.assign({}, S.meta.ai.think, { [m]: step }); save(); continue;
    }
    // An internal error (500) is often not real crowding but Google tripping over the strict-JSON schema or the
    // thinking setting of that model. Once, the same question goes without them; when that answers, remember it.
    if (r.status === 500 && !plainTried && (schema || step !== 'off') && left() > 4000) {
      plainTried = true; schema = null; step = modelVer(m) >= 3 ? 'low' : 'off'; continue;
    }
    // Busy: no retry on the same model (every try counts towards its 20 a day); the next model gets the question.
    break;
  }
  if (plainTried && r.status === 200) { S.meta.ai.plain = Object.assign({}, S.meta.ai.plain, { [m]: 1 }); save(); }
  if ([500, 502, 503, 504].includes(r.status)) { aiBusy[m] = Date.now() + 180000; return { busy: true, msg: `${r.status} ${errMsg(r.body) || ''}`.trim() }; }
  if (r.status === 404) { S.meta.ai.gone = Object.assign({}, S.meta.ai.gone, { [m]: Date.now() + 7 * 864e5 }); save(); return { refresh: true }; }
  if (r.status === 429 && zeroQuota(r.body)) { S.meta.ai.gone = Object.assign({}, S.meta.ai.gone, { [m]: Date.now() + 7 * 864e5 }); save(); return { rate: true, msg: errMsg(r.body) }; }
  if (r.status === 429) { coolDown(m, r.body); return { rate: true, msg: errMsg(r.body) }; }
  if (r.status === 401) return { fatal: { code: 'bad_key' } };
  // 403 is about the key or project only when the message says so; otherwise this one model isn't open to this
  // project (a preview, for example): skip it for a day and ask the next one.
  if (r.status === 403) {
    const msg = errMsg(r.body);
    if (!msg || /api.?key|API_KEY|not been used|disabled|SERVICE_DISABLED|billing/i.test(msg)) return { fatal: { code: 'bad_key', msg } };
    S.meta.ai.gone = Object.assign({}, S.meta.ai.gone, { [m]: Date.now() + 864e5 }); save();
    return { err: { code: 'upstream', msg: `403 ${msg}` } };
  }
  if (r.status === 400) {
    const msg = errMsg(r.body);
    return /api key|API_KEY/i.test(msg) ? { fatal: { code: 'bad_key' } } : { err: { code: 'upstream', msg } };
  }
  if (r.status >= 300) return { err: { code: 'upstream', msg: errMsg(r.body) } };
  let j; try { j = JSON.parse(r.body); } catch (e) { return { err: { code: 'invalid_json' } }; }
  const cand = j.candidates && j.candidates[0];
  // Blocked on purpose (the question itself): another model would block it too. An empty or cut-off answer is just
  // this model having a bad moment: the next model gets the question.
  if (!cand) return j.promptFeedback && j.promptFeedback.blockReason ? { fatal: { code: 'refused', msg: j.promptFeedback.blockReason } } : { err: { code: 'empty' } };
  const text = ((cand.content && cand.content.parts) || []).map(p => p.thought ? '' : (p.text || '')).join('');
  const why = cand.finishReason && cand.finishReason !== 'STOP' ? cand.finishReason : '';
  if (!text.trim()) return /SAFETY|PROHIBITED|BLOCKLIST|SPII/.test(why) ? { fatal: { code: 'refused', msg: why } } : { err: { code: 'empty', msg: why } };
  let value; try { value = looseJSON(text); } catch (e) { return { err: { code: 'invalid_json', msg: `${why ? why + ': ' : ''}${text.slice(0, 80)}` } }; }
  // The pages Google Search looked at, so the app can show where the numbers come from.
  const web = ((cand.groundingMetadata && cand.groundingMetadata.groundingChunks) || []).map(c => c && c.web).filter(w => w && /^https:\/\//i.test(String(w.uri)));
  if (useSearch && web.length && !(S.meta.ai.searchYes || {})[m]) { S.meta.ai.searchYes = Object.assign({}, S.meta.ai.searchYes, { [m]: 1 }); save(); }
  if (value && typeof value === 'object') value.__bronnen = web.filter((x, i) => web.findIndex(y => (y.title || y.uri) === (x.title || x.uri)) === i).slice(0, 6)
    .map(x => ({ title: String(x.title || '').replace(/^www\./, '').slice(0, 60) || 'bron', uri: String(x.uri) }));
  return { ok: true, value };
}
/* Ask the best model first. No answer after a few seconds? Then the next model gets the same question
   alongside it and the first answer wins (at most two at a time, at most 6 models). A model that fails
   hands over straight away. */
const HEDGE_MS = 9000;
/* A model that was never timed counts as 8 seconds (in its score and its time limit), so it gets tried once instead of
   a known slow one; after that its own time counts. */
const UNTIMED_MS = 8000;
/* How often a model was busy (503) lately, kept across restarts: each answer moves it 30% towards 0 (answered) or 1
   (busy). A model that is busy more often than not goes behind the others, so a question doesn't start with a request
   that fails; once it answers again it climbs back by itself. */
/* It also fades by itself: half as much every hour. Before, it only went down when that model answered, but a model at
   the back of the line hardly gets asked, so a busy afternoon kept nearly every Flash model "busy" for good and almost
   every question went to Lite (one day: 26 Lite questions, 2 Flash, and 0 times really busy). A value saved without a
   time (from before this change) counts as old: 0. */
const busyRate = m => { const A = S.meta.ai, v = (A.busy || {})[m] || 0, t = (A.busyT || {})[m]; return v && t ? v * 0.5 ** ((Date.now() - t) / 36e5) : 0; };
function noteBusy(m, wasBusy){
  const A = S.meta.ai, v = busyRate(m) * 0.7 + (wasBusy ? 0.3 : 0);
  A.busy = Object.assign({}, A.busy, { [m]: Math.round(v * 100) / 100 });
  A.busyT = Object.assign({}, A.busyT, { [m]: Date.now() });
  if (A.busy[m] < 0.05) { delete A.busy[m]; delete A.busyT[m]; }
}
/* When to ask a second model as well: twice as long as this model usually takes, between 6 and 12 seconds (9 when
   unknown). Every extra question counts towards your free per-minute limit, so not too soon. While searching the web
   it never does: searching simply takes longer. */
const hedgeAfter = m => { const l = (S.meta.ai.lat || {})[m]; return l ? clamp(Math.round(l * 2), 6000, 12000) : HEDGE_MS; };
/* While you wait: which kind of model is answering, so you know what to expect. The speed is what that model took
   for you (measured on typed meals); a photo or a web search takes longer, so the expected time goes up with it.
   Never measured: a guess from the kind of model. */
const modelLabel = m => m.replace(/^gemini-/, '').replace(/-preview.*$/, ' preview').replace(/-lite/, ' Lite').replace(/-flash/, ' Flash');
function modelSpeed(m, kind, search){
  const lat = (S.meta.ai.lat || {})[m], f = search ? 3 : ['foto', 'recept', 'verbeter', 'ideeen', 'koelkast'].includes(kind) ? 1.8 : 1;
  const ms = (lat || (isLite(m) ? 5500 : 4500)) * f;
  const cls = ms < 4500 ? ['🐇', 'Snel model'] : ms < 8000 ? ['🚶', 'Gemiddeld model'] : ['🐢', 'Langzamer model'];
  const s = Math.round(ms / 1000);
  return `${cls[0]} ${cls[1]} (${modelLabel(m)}) · ${lat ? '' : 'nog niet gemeten, '}meestal ± ${s} s`;
}
function aiModelInfo(m, kind, search, all){
  if (AI_BG.has(kind)) return;
  const st = document.getElementById('aiStatus'); if (!st) return;
  let el = document.getElementById('aiModel');
  if (!el) { el = document.createElement('span'); el.id = 'aiModel'; el.className = 'note'; el.style.display = 'block'; st.after(el); }
  // Your fast requests used up: the rest of the day goes to Lite, so say until when.
  const fastLeft = all.some(x => !isLite(x) && !roomy(x) && !isCool(x) && leftToday(x) > 0);
  el.textContent = modelSpeed(m, kind, search) + (!fastLeft && isLite(m) ? ` · snelle modellen weer om ${new Date(nextQuotaReset() - 60000).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}` : '');
}
/* search: let the model look the numbers up with Google Search (Voedingscentrum first). When this key or model can't
   (no support, or the free search quota is used up), the same question goes without search. */
/* kind: what the question is for (eten, foto, ideeen, score ...), for the overview in the settings. Questions you
   ask yourself mark the moment, so background work (scores, looking up later) waits and leaves your limit to you. */
const AI_BG = new Set(['score', 'later', 'vooruit']);
let aiUserAt = 0;
/* Which models get this question, in order. Left out: a model whose day is used up (or that is cooling down after a
   limit), and for background work a full Flash model with 5 or fewer requests left, so those stay for you. Your own
   questions go to the fastest full Flash model with room; background work and searching the web go to Lite first
   (500 a day). A model that was just busy or is at its per-minute limit goes to the back. */
function aiQueue(all, kind, search){
  // Working ahead while you type is your own meal, not background work: it goes to the same model your question
  // would get (before, it only went to Lite, so most meals were worked out by the least accurate model). It only takes a
  // model that is free right now and, when scarce, has more than 5 left today; it never waits for one.
  if (kind === 'vooruit') {
    const sc = {}, ok = all.filter(m => !isCool(m) && !(aiBusy[m] > Date.now()) && !minuteFull(m) && (roomy(m) ? leftToday(m) > 0 : leftToday(m) > 10));
    ok.forEach(m => { sc[m] = taskScore(m, 'eten', false); });
    const q = ok.sort((a, b) => sc[b] - sc[a]);
    return q.filter(m => busyRate(m) <= 0.5).concat(q.filter(m => busyRate(m) > 0.5));
  }
  const bg = AI_BG.has(kind), liteFirst = bg || search;
  const noS = m => search && !searchOk(m);
  const later = m => aiBusy[m] > Date.now() || minuteFull(m);
  // Background work (looking up later, scores) only uses the roomy Lite models (hundreds a day), and only one that is
  // free right now. Before, it could also take a full Flash model with more than 5 left: then it used up your
  // 5-a-minute while you were logging, and your own question got "limit".
  // A key without any roomy model: then a scarce one with more than 5 left may do it, but only when it is free.
  const anyRoomy = all.some(roomy);
  const usable = all.filter(m => !noS(m) && !isCool(m) && leftToday(m) > 0 && (!bg || (!later(m) && (roomy(m) || (!anyRoomy && leftToday(m) > 5)))));
  // Within each group the model with the best score for this task first (see taskScore); just busy or at its
  // per-minute limit to the back.
  const sc = {}; usable.forEach(m => { sc[m] = taskScore(m, kind, search); });
  const pick = (list) => { const l = [...list].sort((a, b) => sc[b] - sc[a]); return l.filter(m => !later(m)).concat(l.filter(later)); };
  // Your own questions: simply the best score for this task (speed, success, what's left today, and the kind of model
  // the task needs). Background work and searching: the roomy Lite models first, then the scarce ones.
  const many = usable.filter(roomy), full = usable.filter(m => !roomy(m) && !isLite(m)), fewLite = usable.filter(m => !roomy(m) && isLite(m));
  const q = liteFirst ? pick(many).concat(pick(fewLite), pick(full)) : pick(usable);
  // Models that were busy more often than not lately go to the very end, behind the Lite ones that do answer.
  return q.filter(m => busyRate(m) <= 0.5).concat(q.filter(m => busyRate(m) > 0.5));
}
const AI_MAX_MODELS = 3;
/* onPartial: for a long answer, called with the text so far while it streams in (from one model at a time). */
async function aiJSON(prompt, maxMs = 60000, schema, temp = 0, image = null, search = false, kind = 'overig', onPartial = null){
  const t0 = Date.now(), left = () => t0 + maxMs - Date.now();
  if (!AI_BG.has(kind)) aiUserAt = t0;
  let lastModel = '';
  const key = (S.meta.ai.key || '').trim();
  if (!key) throw { code: 'no_key' };
  const models = await modelList(key);
  const ranked = models.filter(m => m !== S.meta.ai.model);   // put in order by aiQueue (model scores)
  // A model picked by hand only counts when it is an ordinary text model (an older list could offer omni and the like).
  const own = textModel(S.meta.ai.model || '') ? S.meta.ai.model : '';
  const all = [...new Set([own, ...ranked].filter(Boolean))].filter(m => !isGone(m));
  const queue = aiQueue(all, kind, search);
  // Background work with no free roomy model right now: don't ask anything, and don't note it as a failure
  // (it simply tries again later). 'quiet' tells the caller to leave the item as it was.
  if (AI_BG.has(kind) && !queue.length) throw { code: 'quiet' };
  // The model you picked yourself goes first (when it has room), the others stay as backup.
  if (own && queue.includes(own) && (!AI_BG.has(kind) || kind === 'vooruit')) { queue.splice(queue.indexOf(own), 1); queue.unshift(own); }
  let started = 0, running = 0, done = false, refreshed = false, sawBusy = false, sawRate = false, rateMsg = '', busyMsg = '', last = null, hedgeT = null;
  let busyN = 0, waited = false, sawSlow = false, sends = 0, win = null;
  const live = new Set();   // requests still on their way; stopped once the question is answered or given up
  let partialFrom = null;   // the model whose streamed text is being shown
  return new Promise((resolve, reject) => {
    const deadT = setTimeout(() => finish(reject, { code: 'slow' }), maxMs);
    function finish(fn, v){ if (done) return; done = true; clearTimeout(hedgeT); clearTimeout(deadT); live.forEach(x => { try { x.abort(); } catch (e) {} }); aiStat(fn === resolve ? 'ok' : (v && v.code) || 'err', Date.now() - t0, search, kind, lastModel, v && v.msg);
      if (!(v && ['no_key', 'quiet', 'bad_key'].includes(v.code))) noteKind(kind, fn === resolve, Date.now() - t0, image, sends, win); save(); fn(v); }
    function next(){
      if (done || running >= 2) return;
      // Models that were only busy don't use up the three tries: busy is per model, so two more may be asked.
      if (started - Math.min(busyN, 2) - (waited ? 1 : 0) >= AI_MAX_MODELS || !queue.length || left() < 3000) {
        if (running) return;
        // Everything busy and still time: wait a few seconds and ask the least busy model once more.
        if (sawBusy && !waited && left() > 12000 && all.length) {
          waited = true; aiStatus('Google is even druk, ik probeer het over een paar tellen nog een keer…');
          const again = all.filter(m => !isCool(m) && leftToday(m) > 0).sort((a, b) => roomy(b) - roomy(a))[0];
          if (again) { queue.unshift(again); setTimeout(next, 4000); return; }
        }
        finish(reject, left() < 3000 || (sawSlow && !sawBusy && !sawRate) ? { code: 'slow' } : sawBusy ? { code: 'busy', msg: busyMsg } : sawRate || !started ? { code: 'rate_limited', msg: rateMsg || (!started ? 'Alle modellen hebben hun daglimiet bereikt (telling van Knabbel).' : '') } : last || { code: 'model' });
        return;
      }
      const m = queue.shift(), t1 = Date.now(); started++; running++; lastModel = m;
      aiModelInfo(m, kind, search, all);
      // Only say Google is busy when it really answered so; mostly the first model is just taking its time.
      if (started > 1) aiStatus(sawSlow && !running ? 'Dat model was te traag, ik vraag het aan een ander model…' : sawBusy ? 'Google is even druk, ik vraag het aan een ander model…' : sawRate ? 'Je limiet bij dit model is even op, ik vraag het aan een ander model…' : 'Dit duurt wat langer, ik vraag het tegelijk aan een tweede model…');
      // Slow answer: ask a second model alongside, but only a Lite one (500 a day); a second full Flash request would
      // cost one of its 20 a day and push it over its 5 a minute.
      // No second model alongside a streaming answer: you already see it coming in.
      clearTimeout(hedgeT); if (!search && !onPartial && kind !== 'vooruit' && queue.length && roomy(queue[0])) hedgeT = setTimeout(next, hedgeAfter(m));
      const onText = onPartial ? txt => { if (done || (partialFrom && partialFrom !== m)) return; partialFrom = m; onPartial(txt); } : null;
      askModel(m, key, prompt, left, !queue.length, schema, temp, image, search, kind, live, onText).then(res => {
        running--;
        if (done) return;
        sends += (res.meter && res.meter.sends) || 0;
        if (!res.ok && partialFrom === m) partialFrom = null;   // this model stopped: the next one may show its text
        // Too slow this time: that model waits 3 minutes like a busy one, and counts as slower from now on, so it
        // moves down the list (see taskScore). The error is noted, the question goes on.
        if (res.slowModel) {
          aiBusy[m] = Date.now() + 180000; sawSlow = true;
          const A = S.meta.ai, took = Date.now() - t1;
          if (!search && !image && kind === 'eten') A.lat = Object.assign({}, A.lat, { [m]: Math.round(((A.lat || {})[m] || UNTIMED_MS) * 0.6 + took * 0.4) });
          A.errs = [{ at: Date.now(), kind, model: m.replace(/^gemini-/, ''), code: 'slow', msg: res.err.msg }, ...(A.errs || [])].slice(0, 8);
          save();
        }
        if (res.ok || res.busy) noteBusy(m, !!res.busy);
        if (res.ok) {
          const A = S.meta.ai;
          // Speed per model, only from ordinary questions: searching the web or a photo simply take longer.
          if (!search && !image && kind === 'eten') A.lat = Object.assign({}, A.lat, { [m]: Math.round(((A.lat || {})[m] || Date.now() - t1) * 0.6 + (Date.now() - t1) * 0.4) });
          if (A.lastGood !== m || isCool(m)) { A.lastGood = m; if (A.cool) delete A.cool[m]; }
          // Still answering past the limit we assumed: this key has more (paid), so stop holding back.
          if (usedToday(m) > dayLimit(m)) A.lim = Object.assign({}, A.lim, { [m]: usedToday(m) * 2 });
          save();
          win = res.meter;
          return finish(resolve, res.value);
        }
        if (res.fatal) return finish(reject, res.fatal);
        if (res.busy) { sawBusy = true; busyN++; busyMsg = `${m.replace(/^gemini-/, '')}: ${res.msg || ''}`; }
        if (res.rate) { sawRate = true; if (res.msg) rateMsg = res.msg; }
        if (res.err) last = res.err;
        if (res.refresh && !refreshed) {
          refreshed = true;
          modelList(key, true).then(ms => { ms.forEach(x => { if (!all.includes(x) && !isGone(x) && aiQueue([x], kind, search).length) { all.push(x); queue.push(x); } }); next(); }).catch(() => next());
          return;
        }
        next();
      });
    }
    next();
  });
}
/* Today's AI questions, to see in the settings whether "busy" really happens: answered, busy, limit, too slow. */
const AI_KIND = { vraag: 'Vragen aan Knabbel', eten: 'Eten uitrekenen', foto: "Foto's", recept: 'Recepten', etiket: 'Etiketten', verbeter: 'Verbeteren', kandit: 'Kan dit?', ideeen: 'Ideeën', koelkast: 'Koelkastfoto', opzoeken: 'Opzoeken op internet', score: 'Scores (achtergrond)', vooruit: 'Alvast uitrekenen (achtergrond)', later: 'Later opzoeken (achtergrond)', test: 'Sleutel testen', overig: 'Overig' };
const AI_ERR = { busy: 'Google was druk', rate_limited: 'je limiet was op', slow: 'duurde te lang', network: 'geen internet', bad_key: 'sleutel werkt niet', invalid_json: 'antwoord was geen geldige JSON', upstream: 'Google gaf een fout', model: 'geen model beschikbaar', refused: 'geweigerd door Google', empty: 'leeg antwoord', nokcal: 'antwoord zonder kcal', nosearch: 'model kan niet zoeken', search_off: 'zoeklimiet op' };
function aiStat(code, ms, search, kind = 'overig', model = '', msg = ''){
  const A = S.meta.ai, k = todayKey();
  if (!A.stats || A.stats.day !== k || !A.stats.kinds) A.stats = { day: k, ok: 0, busy: 0, rate_limited: 0, slow: 0, err: 0, ms: 0, kinds: {} };
  const K = A.stats.kinds[kind] ||= { n: 0, ms: 0, fail: 0 };
  if (code === 'ok') { K.n++; K.ms += ms; A.stats.ok++; A.stats.ms += ms; return; }
  K.fail++;
  A.stats[['busy', 'rate_limited', 'slow'].includes(code) ? code : 'err']++;
  A.errs = [{ at: Date.now(), kind, model: String(model || '').replace(/^gemini-/, ''), code, msg: String(msg || '').slice(0, 120) }, ...(A.errs || [])].slice(0, 8);
}
function aiStatsHTML(){
  const st = S.meta.ai.stats; if (!st || st.day !== todayKey() || !st.kinds) return '';
  const n = st.ok + st.busy + st.rate_limited + st.slow + st.err; if (!n) return '';
  const sec = ms => String(r1(ms / 1000)).replace('.', ',');
  const kinds = Object.entries(st.kinds).sort((a, b) => (b[1].n + b[1].fail) - (a[1].n + a[1].fail));
  const errs = (S.meta.ai.errs || []).filter(e => e.at > Date.now() - 864e5).slice(0, 5);
  const hm = t => new Date(t).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  return `<div class="card eqs aistats"><div class="eq"><span>Vragen vandaag</span><b class="num">${n}${n - st.ok ? ` · ${n - st.ok} mislukt` : ''}</b></div>
    ${kinds.map(([k, v]) => `<div class="eq"><span>${AI_KIND[k] || esc(k)}</span><b class="num">${v.n}×${v.n ? ` · gem. ${sec(v.ms / v.n)} s` : ''}${v.fail ? ` · ${v.fail} mislukt` : ''}</b></div>`).join('')}
    ${S.meta.ai.searchCool > Date.now() ? `<div class="eq"><span>Opzoeken op internet<br><span class="note">zoeklimiet op, gewone vragen werken wel</span></span><b class="num">gepauzeerd tot ${hm(S.meta.ai.searchCool)}</b></div>` : ''}
    ${(() => { const used = Object.entries(aiUse().n).filter(([, v]) => v > 0).sort((a, b) => isLite(a[0]) - isLite(b[0]) || b[1] - a[1]);
      return used.length ? `<div class="eq"><span>Verbruikt vandaag<br><span class="note">gratis limiet per model, weer vol om ${hm(nextQuotaReset() - 60000)}</span></span><b class="num" style="text-align:right">${used.map(([m, v]) => `${esc(m.replace(/^gemini-/, ''))} ${Math.min(v, dayLimit(m))}/${dayLimit(m)}`).join('<br>')}</b></div>` : ''; })()}
    ${errs.length ? `<details class="more-rows"><summary>Laatste fouten (${errs.length}) ›</summary><div>${errs.map(e => `<p class="note">${hm(e.at)} · ${AI_KIND[e.kind] || esc(e.kind)}${e.model ? ` · ${esc(e.model)}` : ''}: <b>${AI_ERR[e.code] || esc(e.code)}</b>${e.msg ? `<br>${esc(e.msg)}` : ''}</p>`).join('')}</div></details>` : ''}</div>`;
}
/* Open the connection to Google while you type, so the question itself starts faster. */
let warmAt = 0;
function warmAI(){
  if (!S.meta.ai.key || Date.now() - warmAt < 60000) return; warmAt = Date.now();
  fetch('https://generativelanguage.googleapis.com/', { mode: 'no-cors', credentials: 'omit', cache: 'no-store' }).catch(() => {});
}
function errCopy(e){
  // The key is fine, but the Gemini API is switched off in its Google project.
  if (e && e.code === 'bad_key' && /not been used|disabled|SERVICE_DISABLED/i.test(e.msg || '')) return 'Je sleutel is goed, maar de Gemini API staat uit in dat Google-project. Maak de sleutel opnieuw aan op aistudio.google.com/apikey, dan staat hij meteen aan.';
  return ({
    no_key: 'Stel eerst je gratis AI-sleutel in (Instellingen, AI). Of gebruik Handmatig.',
    bad_key: 'Je AI-sleutel werkt niet. Controleer of je hem helemaal hebt gekopieerd, in Instellingen.',
    rate_limited: 'Je gratis daglimiet of minuutlimiet is even bereikt. Probeer het over een minuut opnieuw, of morgen.',
    busy: 'De gratis AI van Google is op dit moment erg druk. Probeer het over een minuutje opnieuw.',
    off_busy: 'De productdatabase is even druk. Probeer het over een minuutje opnieuw.',
    slow: 'Dit duurt te lang. Probeer het zo opnieuw, of vul het zelf in.',
    network: 'Geen internetverbinding. Controleer je wifi of mobiele data.',
    refused: 'De AI weigerde dit verzoek. Probeer het anders te omschrijven.',
    invalid_json: 'Het antwoord was onleesbaar. Probeer het nog eens.',
    empty: 'Er kwam geen antwoord. Probeer een kortere omschrijving.',
    model: 'Het AI-model is niet beschikbaar. Kies in Instellingen een ander model.'
  })[e && e.code] || 'Er ging iets mis bij de AI. Probeer het opnieuw.' + (e && e.msg ? ' (' + e.msg + ')' : '');
}
/* An item keeps its amount in a unit you'd say out loud (2 boterhammen, 1 glas) and its values per 1 unit,
   so changing the amount recalculates everything. Grams/ml only for things you don't count. */
const isMass = u => /^(g|gram|ml)$/i.test(String(u || ''));
function mkItem(o){
  let qty = num(o.qty ?? o.aantal), unit = String(o.unit ?? o.eenheid ?? '').trim().toLowerCase();
  const grams = num(o.grams ?? o.gram ?? o.hoeveelheid);
  // No amount: with a weight it is that weight in grams; with nothing at all it is 1 portion (or 1 of the unit named),
  // without a weight. It used to become "100 g" without a word: then "1 bord lasagne" from an answer without grams was
  // worked out as 100 g lasagne, and a pinch of spice in an idea showed as 100 g. Now the usual safety nets take over:
  // the weight of that measure for this product (gramsFromUnit), else the orange "check" label.
  if (!unit || !qty) {
    if (grams > 0) { unit = 'g'; qty = grams; }
    else { unit = unit && !isMass(unit) ? unit : 'portie'; qty = 1; }
  }
  if (isMass(unit)) { unit = /ml/i.test(unit) ? 'ml' : 'g'; qty = r0(qty); }
  const it = { name: String(o.name ?? o.naam ?? 'Onbekend').slice(0, 80), qty, unit, unitPl: String(o.unitPl ?? o.eenheid_mv ?? '').trim().toLowerCase() || (unit === 'portie' ? 'porties' : unit),
    grams: grams || (isMass(unit) ? qty : 0), kcal: num(o.kcal), p: num(o.p ?? o.eiwit ?? o.protein), c: num(o.c ?? o.koolhydraten ?? o.carbs), f: num(o.f ?? o.vet ?? o.fat) };
  const sf = o.sf ?? o.verzadigd ?? o.verzadigd_vet;
  it.sf = sf == null || sf === '' ? null : Math.min(num(sf), it.f || num(sf));
  if (o.hidden || o.verborgen === true) it.hidden = true;
  if (o.off) it.off = true;          // package values from Open Food Facts
  if (o.fixed) it.fixed = true;      // kcal worked out again from the macros
  const nv = num(o.nevo); if (nv && NEVO && NEVO.has(nv)) { it.nevo = nv; if (o.nevoName) it.nevoName = o.nevoName; if (o.approx || o.benadering === true) it.approx = true; }
  const bron = String(o.bron ?? '').trim();
  if (bron) it.bron = bron.slice(0, 40);   // where the AI found the numbers ("schatting" when it could not look it up)
  const ml = o.ml ?? o.vocht_ml;
  if (ml != null && ml !== '') it.ml = num(ml);
  it.base = { g: it.grams / qty, kcal: it.kcal / qty, p: it.p / qty, c: it.c / qty, f: it.f / qty, sf: it.sf != null ? it.sf / qty : null, ml: it.ml != null ? it.ml / qty : null };
  return it;
}
function setQty(it, q){
  it.qty = q; it.grams = r0(it.base.g * q);
  it.kcal = it.base.kcal * q; it.p = it.base.p * q; it.c = it.base.c * q; it.f = it.base.f * q;
  if (it.base.sf != null) it.sf = it.base.sf * q;
  if (it.base.ml != null) it.ml = it.base.ml * q;
}
/* Fluid in ml: what the AI gave, otherwise a guess for drinks from the name and the amount.
   Coffee and tea count (as the Voedingscentrum says); alcohol does not. */
const DRINK_RE = /koffie|cappuccino|latte|espresso|macchiato|\bthee\b|kruidenthee|\bwater\b|\bspa\b|melk|chocomel|karnemelk|yoghurtdrank|drinkyoghurt|cola|frisdrank|fanta|sprite|limonade|ranja|ice ?tea|sap\b|jus d|smoothie|shake|energy|bouillon|soep/;
const NOT_DRINK = /chocola|ijs\b|pudding|vla\b|koek|brood|poeder|kaas|stengel|reep/;
const UNIT_ML = { glas: 200, glaasje: 150, kop: 150, kopje: 125, mok: 250, beker: 250, blik: 330, blikje: 330, fles: 500, flesje: 330, pak: 200, pakje: 200, portie: 200, kom: 250 };
function itemMl(i){
  if (i.ml != null) return num(i.ml);
  const n = String(i.name || '').toLowerCase();
  if (!DRINK_RE.test(n) || ALCOHOL.test(n) || NOT_DRINK.test(n)) return 0;
  if (i.unit === 'ml') return num(i.qty);
  if (i.grams > 0) return num(i.grams);
  return (UNIT_ML[i.unit] || 0) * num(i.qty);
}
const itemsMl = (items, mult = 1) => r0(items.reduce((a, i) => a + itemMl(i), 0) * mult);
const entryMl = e => e.pending ? 0 : itemsMl(e.items || [], e.mult || 1);
const drinksMl = k => day(k).entries.reduce((a, e) => a + entryMl(e), 0);
/* Water from the buttons plus everything you drank. */
const fluidMl = k => (day(k).water || 0) + drinksMl(k);
/* How much to drink per day. You need about 35 ml of water per kg of a healthy weight (extra fat holds little water);
   roughly a fifth of that comes from food, so 28 ml per kg from drinks. On an active day 1 ml extra per kcal you burn extra. Your own number wins if you set one. */
const WATER_PER_KG = 28;
function waterGoal(k = todayKey()){
  const P = S.profile; if (P.water) return P.water;
  const base = (P.targets?.refW || P.weight || 75) * WATER_PER_KG, extra = moveOn() ? clamp(moveInfo(k).extra, 0, 1000) : 0;
  return clamp(Math.round((base + extra) / 50) * 50, 1500, 4000);
}
function waterWhy(k){
  const P = S.profile; if (P.water) return `Je eigen doel van ${P.water} ml.`;
  const extra = moveOn() ? r0(clamp(moveInfo(k).extra, 0, 1000) / 50) * 50 : 0;
  const w = P.targets?.refW || P.weight;
  return `${kgStr(w)} kg${w < P.weight ? ' (je gezonde gewicht, zoals bij eiwit)' : ''} × ${WATER_PER_KG} ml${extra ? ` + ${extra} ml omdat je meer bewoog` : ''}. Het vocht uit je eten is hier al vanaf.`;
}
function checkWaterGoal(k){
  const d = S.days[k]; if (!d || d.flags?.water || k !== todayKey()) return;
  if (fluidMl(k) >= waterGoal(k)) { d.flags.water = true; save(); reward(2, 5, 'Vochtdoel gehaald!'); }
}
const fmtQty = q => { const w = Math.floor(q), h = Math.abs(q - w - 0.5) < 0.01; return h ? (w ? w + '½' : '½') : String(r1(q)).replace('.', ','); };
const qtyLabel = it => isMass(it.unit) ? `${r0(it.qty)} ${it.unit}` : `${fmtQty(it.qty)} ${it.qty > 1 ? it.unitPl : it.unit}`;
function stepQty(it, dir){
  if (isMass(it.unit)) { const st = it.qty >= 200 ? 25 : 10; return Math.max(st, r0((it.qty + dir * st) / st) * st); }
  if (dir > 0) return it.qty < 1 ? 1 : Math.floor(it.qty) + 1;
  return it.qty > 1 ? Math.ceil(it.qty) - 1 : 0.5;
}
function normItems(arr){ return (Array.isArray(arr) ? arr : []).map(mkItem).filter(o => o.name); }

/* Answers are remembered per description (lower case, single spaces), so typing the same thing again
   gives the same numbers straight away: no AI call, works offline. Your own corrections overwrite it. */
const AI_CACHE_MAX = 300;
/* The same meal said a bit differently finds the same answer: case, accents and punctuation don't matter, nor small
   words that don't change the food ("een", "ik had", "met", "en", a "1" for one of something) or the order of the
   words ("brood met kaas" = "kaas en brood"). Words that do change it stay: amounts, "zonder", "half", sizes. */
const CACHE_SKIP = new Set(['een', '1', 'ik', 'had', 'heb', 'hebben', 'gegeten', 'gedronken', 'vandaag', 'en', 'met', 'plus', 'nog', 'ook', 'genomen', 'op']);
/* An amount belongs to the word after it ("2 boterhammen" and "3 plakken kaas" stay apart from "3 boterhammen" and "2 plakken
   kaas"): the number (and a unit like g or ml) is glued to the next word before the words are put in order. A lone "1"
   is skipped like the small words. */
const CACHE_UNIT = new Set(['g', 'gr', 'gram', 'kg', 'ml', 'cl', 'l', 'liter']);
function cacheKey(t){
  const toks = foldText(t).replace(/[^a-z0-9½¼¾,.\s]/g, ' ').replace(/(\d)[,.](\d)/g, '$1_$2').replace(/[,.]/g, ' ').split(/\s+/).filter(Boolean), out = [];
  let amount = '';
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];
    if (/^[0-9½¼¾_]+$/.test(w)) { if (w !== '1' || CACHE_UNIT.has(toks[i + 1])) amount = w; continue; }
    if (CACHE_UNIT.has(w) && amount) { amount += w; continue; }
    if (CACHE_SKIP.has(w)) continue;
    out.push(amount ? amount + '_' + w : w); amount = '';
  }
  if (amount) out.push(amount);
  return out.sort().join(' ');
}
const cacheKeyOld = t => String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');   // answers saved before this change
function cacheGet(text){
  // Answers remembered before October 7 came mostly from Flash-Lite at a high temperature and without the NEVO check:
  // forgotten once, so the same text is worked out again the more accurate way.
  if (S.meta.aiCacheV !== 3) { S.meta.aiCache = {}; S.meta.aiCacheV = 3; }   // 3: amounts now belong to their words
  const C0 =S.meta.aiCache || {}, c = C0[cacheKey(text)] || C0[cacheKeyOld(text)]; if (!c) return null;
  return { ...c, items: c.items.map(mkItem), src: 'ai' };
}
function cachePut(text, R){
  const k = cacheKey(text); if (!k) return;
  const C0 = S.meta.aiCache ||= {};
  C0[k] = { title: R.title, icon: R.icon || '', mult: R.mult || 1, confidence: R.confidence || '', score: R.score || null, tip: R.tip || '',
            items: R.items.map(({ base, ...i }) => ({ ...i, kcal: r1(i.kcal), p: r1(i.p), c: r1(i.c), f: r1(i.f), ...sfOut(i) })), at: Date.now() };  // keeps off/fixed marks
  const keys = Object.keys(C0);
  if (keys.length > AI_CACHE_MAX) keys.sort((a, b) => C0[a].at - C0[b].at).slice(0, keys.length - AI_CACHE_MAX).forEach(x => delete C0[x]);
}
/* Numbers that cannot be right: more than 9 kcal per gram, kcal far off from the macros
   (4 per g protein/carbs, 9 per g fat; alcohol is left out), a drink over 400 kcal. */
const ALCOHOL = /bier|pils|wijn(?!saus|azijn|gom)|prosecco|champagne|cava|cocktail|mojito|wodka|vodka|whisk|\brum\b|\bgin\b|likeur|jenever|\bport\b|sherry|radler|cider|alcohol|tequila|sambuca|flugel|flügel/;
const DRINK = /glas|kop|mok|beker|blik|flesje|fles|ml/;
function suspectWhy(it){
  const kcal = it.kcal, macro = 4 * it.p + 4 * it.c + 9 * it.f;
  if (it.nokcal && !(kcal > 0)) return 'geen kcal gevonden, vul ze in of laat het opnieuw uitrekenen';
  if (it.grams > 0 && kcal / it.grams > 9.2) return 'meer kcal dan kan per gram';
  if (kcal >= 60 && macro > 0 && !ALCOHOL.test(it.name.toLowerCase()) && Math.abs(kcal - macro) / Math.max(kcal, macro) > 0.3) return 'kcal passen niet bij eiwit, koolh. en vet';
  if (DRINK.test(it.unit) && kcal > 400 && !/shake|smoothie|milkshake/.test(it.name.toLowerCase())) return 'veel voor een drankje';
  return '';
}
function resultSuspect(R){
  const t = itemsTotals(R.items, R.mult || 1);
  return R.confidence === 'laag' || t.kcal > 2500 || R.items.some(i => suspectWhy(i));
}
/* The AI's JSON turned into a result the sheet can show, or an error text. */
/* Kcal that can't be right (more than 9 per gram, or far off from 4×protein + 4×carbs + 9×fat) is worked out again
   from the macros, as long as those fit in the weight. Alcohol is left alone (7 kcal per gram that isn't in the macros). */
function fixItem(it){
  if (ALCOHOL.test(it.name.toLowerCase())) return it;
  const macro = 4 * it.p + 4 * it.c + 9 * it.f, mg = it.p + it.c + it.f;
  const macrosFitWeight = !it.grams || mg <= it.grams * 1.05;
  const tooDense = it.grams > 0 && it.kcal / it.grams > 9.2;
  const off = it.kcal >= 60 && macro > 0 && Math.abs(it.kcal - macro) / Math.max(it.kcal, macro) > 0.3;
  const missing = !(it.kcal > 0) && macro >= 5;
  if ((tooDense || off || missing) && macro > 0 && macrosFitWeight) { it.kcal = macro; it.base.kcal = macro / (it.qty || 1); it.fixed = true; }
  return it;
}
/* A part the AI gave neither a (valid) NEVO code nor kcal for used to count as 0 kcal without a word. Now it is marked
   (an orange "check" line) and looked up on the web like any part NEVO doesn't have. Guessing a NEVO product by name
   alone was tried and picked wrong too often ("volkoren brood" became a toastie). Water, tea, black coffee and
   "zero"/"light" drinks may really be 0. */
const ZERO_OK = /\b(water|spa|thee|koffie|espresso|zero|light|bouillon)\b/i;
function noKcalFix(it){
  if (!it.nevo && !it.off && !(it.kcal > 0) && !ZERO_OK.test(it.name)) it.nokcal = true;
  return it;
}
/* No grams from the AI (it says "1 bakje" but no weight): the weight of that measure for this product from the table of
   practical measures (skyr: bakje 150 g), or for a drink the usual glass or cup. The unit has to match; a measure of
   another product is never borrowed. Still unknown: the item keeps no weight and gets the "check" label. */
function gramsFromUnit(it){
  if (it.grams > 0 || isMass(it.unit)) return it;
  const u = String(it.unit || '').toLowerCase(), m = typeof measuresFor === 'function' && measuresFor(it).find(x => x.u === u || x.pl === u);
  const g = m ? m.g : UNIT_ML[u] && DRINK_RE.test(foldText(it.name)) ? UNIT_ML[u] : 0;
  if (g > 0) { it.grams = g * (it.qty || 1); it.base = { ...it.base, g }; }
  return it;
}
/* A NEVO code that doesn't fit what the AI itself thinks the food is (more than 1.6× off in kcal per 100 g) is most likely
   the wrong line of the list: then the best NEVO product near the AI's own estimate is taken and looked up as an
   approximation, or, when there is none, the AI's estimate stays (and gets looked up like any part NEVO doesn't have).
   A brand, shop or flavour in the name ("AH skyr perziksmaak") is never exactly the NEVO product: always looked up. */
const FLAVOUR_RE = /smaak|aroma|\bvanille|aardbei|perzik|framboos|kers|bosvruchten|mango|citroen|stracciatella|chocola/;
/* Does a NEVO product fit what the AI says the food is? 'no': clearly another product (kcal per 100 g more than 1.35×
   off, the make-up clearly different, or another name and the kcal more than 1.15× off). 'approx': the name doesn't
   match (bread with the code of a toastie) but the numbers are close: shown as an approximation and looked up.
   Before, only kcal more than 1.6× off counted, so a wrong line of the list often went through. */
function nevoFits(name, est, mine, n){
  const ratio = est && n.kcal > 0 ? Math.max(est / n.kcal, n.kcal / est) : 1;
  const has = mine && mine.p + mine.c + mine.f > 0;
  const diff = x => Math.abs(mine[x] - n[x]), far = x => diff(x) > 0.5 * Math.max(mine[x], n[x]);
  const apart = has ? ['p', 'c', 'f'].filter(x => diff(x) > 8 && far(x)).length : 0, wild = has && ['p', 'c', 'f'].some(x => diff(x) > 15 && far(x));
  // The same product by name: NEVO finds it for these words, or a word shares its start (aardappels ~ aardappelen).
  const ws = t => foldText(t).split(/[^a-z]+/).filter(w => w.length >= 5), mineW = ws(name), theirs = ws(n.name + ' ' + (n.syn || ''));
  const cands = nevoCandidates(name, 90, false), named = !cands.length || cands.some(x => x.code === n.code) || mineW.some(w => theirs.some(v => v.slice(0, 6) === w.slice(0, 6)));
  // Far off in kcal per 100 g only counts when it is more than a few kcal (coffee with milk: 8 or 12 is the same thing).
  const dk = est && n.kcal > 0 ? Math.abs(est - n.kcal) : 0;
  if ((ratio > 1.35 && dk > 20) || apart >= 2 || wild || (!named && ratio > 1.15 && dk > 10)) return 'no';
  return named ? 'ok' : 'approx';
}
function checkNevo(it){
  const est = it.kcal > 0 && it.grams > 0 ? it.kcal / it.grams * 100 : null, own = { ...it, base: { ...it.base } };
  // The AI's own protein, carbs and fat per 100 g: a code whose make-up is clearly different (bread with the code of a
  // spread: much fat instead of much carbs) is also the wrong line, even when the kcal happen to be near.
  const per = v => it.grams > 0 ? v / it.grams * 100 : 0, mine = { p: per(it.p), c: per(it.c), f: per(it.f) };
  applyNevo(it);
  if (!it.nevo) return it;
  const n = NEVO.get(it.nevo), name = foldText(it.name), fits = nevoFits(it.name, est, mine, n);
  if (fits === 'approx') {
    // Another name with close numbers (an apple with the code of a pear): a NEVO product that does carry this name wins.
    const better = est && nevoMatch(it.name, est, mine.p + mine.c + mine.f > 0 ? mine : null);
    if (better && better.code !== it.nevo && nevoFits(it.name, est, mine, better) === 'ok') { it.nevo = better.code; applyNevo(it); delete it.approx; }
    else it.approx = true;
  }
  if (fits === 'no') {
    const pick = est && nevoMatch(it.name, est, mine.p + mine.c + mine.f > 0 ? mine : null);
    if (pick && pick.code !== it.nevo) { it.nevo = pick.code; applyNevo(it); it.approx = true; return it; }
    Object.assign(it, own); delete it.nevo; delete it.nevoName; delete it.approx; if (!it.bron || it.bron === 'NEVO') it.bron = 'schatting';
    return fixItem(it);
  }
  // ("skyr" is in the brand list for Open Food Facts, but plain skyr is just the NEVO product)
  if (BRAND_RE.test(name.replace(/\bskyr\b/g, '')) || (FLAVOUR_RE.test(name) && !FLAVOUR_RE.test(foldText(n.name + ' ' + n.syn)))) it.approx = true;
  return it;
}
/* Without searching, a "source" the AI names (Voedingscentrum, AH ...) is only its own guess: it says "schatting". */
const noFakeBron = i => { if (!i.nevo && !i.off && i.bron && !/^schatting/i.test(i.bron)) i.bron = 'schatting'; return i; };
function resultFromAI(res){
  if (res && res.geen_eten) return { error: 'Geen eten gevonden: ' + (res.reden || 'probeer een duidelijkere omschrijving.') };
  const items = normItems(res && res.items).map(gramsFromUnit).map(checkNevo).map(i => i.nevo ? i : fixItem(i)).map(noKcalFix).map(noFakeBron);
  if (!items.length) return { error: 'Ik kon geen onderdelen herkennen. Probeer het anders te omschrijven.' };
  return { result: { title: String(res.titel || items[0].name).slice(0, 80), icon: String(res.emoji || '').slice(0, 8), items, mult: 1,
    confidence: res.zekerheid || '', score: clamp(r0(res.score), 0, 10) || null, tip: String(res.tip || '').slice(0, 200), src: 'ai', portions: normPortions(res.porties), sources: Array.isArray(res.__bronnen) ? res.__bronnen : [],
    question: res.vraag && res.vraag.tekst && Array.isArray(res.vraag.opties) && res.vraag.opties.length >= 2
      ? { text: String(res.vraag.tekst).slice(0, 140), options: res.vraag.opties.slice(0, 4).map(o => String(o).slice(0, 40)) } : null } };
}
/* NEVO: the official Dutch food composition table (RIVM), the same one the Voedingscentrum uses. Loaded from nevo.js
   (made by tools/nevo.py, values unchanged, per 100 g or 100 ml). The AI only says which NEVO product and how much;
   the app works out kcal and macros from the table. */
const NEVO = (() => {
  const d = window.NEVO_DATA; if (!d) return null;
  const m = new Map();
  d.split('\n').forEach(l => { const f = l.split('|'); m.set(+f[0], { code: +f[0], name: f[1], syn: f[2], kcal: num(f[3]), p: num(f[4]), c: num(f[5]), f: num(f[6]), sf: f[7] === '' ? null : num(f[7]), fib: num(f[8]), sug: num(f[9]), ml: f[10] === '1' }); });
  return m;
})();
// The whole table as text, only made when it is needed (refining a photo used to send it; now hardly anything does).
let nevoListMemo = null;
const nevoList = () => nevoListMemo ??= NEVO ? [...NEVO.values()].map(x => `${x.code} ${x.name}${x.syn ? ` (${x.syn.slice(0, 40)})` : ''}`).join('\n') : '';
/* Sending all 2270 products with every question makes it slow and eats the free limit. So the app first looks up
   which NEVO products fit the words (also inside compound words: "volkorenbrood" finds "brood"), plus a few things
   that are often eaten along (spread, oil, sauce, milk, sugar). A photo still gets the whole table. */
const foldText = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const NEVO_STOP = new Set(['met', 'een', 'van', 'and', 'het', 'der', 'den', 'voor', 'bij', 'uit', 'ook', 'nog', 'wat', 'zonder', 'gram', 'gr', 'stuk', 'stuks', 'portie', 'porties', 'beetje', 'paar', 'half', 'halve', 'hele', 'heel', 'groot', 'grote', 'klein', 'kleine', 'flink', 'flinke', 'glas', 'glazen', 'kop', 'kopje', 'mok', 'bord', 'bakje', 'schaaltje', 'eetlepel', 'eetlepels', 'theelepel', 'plak', 'plakjes', 'plakken', 'snee', 'handje', 'handjevol', 'zak', 'zakje', 'blik', 'pak', 'ml', 'liter', 'kilo', 'vandaag', 'gisteren', 'ochtend', 'middag', 'avond', 'lunch', 'ontbijt', 'diner', 'avondeten', 'tussendoortje', 'snack', 'gegeten', 'gedronken', 'had', 'heb', 'nam', 'ongeveer', 'zelfgemaakt', 'huis', 'thuis', 'daarbij', 'erbij', 'erop', 'ervan']);
const NEVO_ALIAS = { boterham: 'brood', boterhammen: 'brood', sneetje: 'brood', sneetjes: 'brood', bammetje: 'brood', patat: 'frites', friet: 'frites', patatje: 'frites', cola: 'frisdrank', sinas: 'frisdrank', limonade: 'limonadesiroop', eieren: 'ei', eitje: 'ei', eitjes: 'ei', spiegelei: 'ei', omelet: 'ei', aardappel: 'aardappelen', piepers: 'aardappelen', smeren: 'halvarine', roomboter: 'boter', zuivel: 'yoghurt', bami: 'mie', nasi: 'rijst', spaghetti: 'pasta', macaroni: 'pasta', penne: 'pasta' };
const NEVO_HOW = new Set(['rauw', 'gekookt', 'gebakken', 'gefrituurd', 'gegrild', 'bereid', 'gestoomd', 'gestoofd', 'magere', 'halfvolle', 'volle', 'naturel', 'light', 'zoet', 'zout', 'gezouten', 'ongezouten', 'vers', 'verse', 'diepvries', 'blik']);
const NEVO_ALONG = [/^Halvarine 40%/, /^Boter gezouten/, /^Olie (zonnebloem|olijf)/, /^Bak- en braadvet vloeibaar/, /^Mayonaise/, /^Fritessaus/, /^Ketchup/, /^Suiker/, /^Melk halfvolle$/, /^Slagroom/];
/* A word index on the table, like the index at the back of a book: every word points to the products that have it.
   A search then only looks at the ±5000 different words instead of all 2270 products word by word (before: ± 50 ms
   on a computer, ± 250 ms on a phone; now a few ms). Built in a quiet moment just after the app starts, so starting
   is not slower, and ready before you search; asked earlier, it is built right then. */
let nevoIdxMemo = null;
function nevoIdx(){
  if (nevoIdxMemo || !NEVO) return nevoIdxMemo || { list: [], words: new Map(), along: [] };
  const list = [...NEVO.values()].map(x => ({ x, w: foldText(x.name + ' ' + x.syn).split(/[^a-z0-9]+/).filter(w => w.length >= 2) }));
  const words = new Map();
  list.forEach((e, i) => new Set(e.w).forEach(n => { let a = words.get(n); if (!a) words.set(n, a = []); a.push(i); }));
  // The things often eaten along (spread, oil, sauce ...), looked up once.
  const along = NEVO_ALONG.flatMap(re => list.filter(e => re.test(e.x.name)).slice(0, 2).map(e => e.x));
  return nevoIdxMemo = { list, words, along };
}
(window.requestIdleCallback || (f => setTimeout(f, 1500)))(() => nevoIdx());
function nevoLine(x){ return `${x.code} ${x.name}${x.syn ? ` (${x.syn.slice(0, 40)})` : ''}`; }
const nevoWordMemo = new Map();
function nevoCandidates(text, max = 90, along = true){
  const q = [...new Set(foldText(text).split(/[^a-z0-9]+/).map(w => NEVO_ALIAS[w] || w).filter(w => (w.length >= 3 || w === 'ei') && !NEVO_STOP.has(w) && !/^\d+$/.test(w)))];
  // How well a word of the product fits a word you typed: the same word, the start of it, or inside a compound word.
  const fit = (n, w) => n === w ? 10 : (w.length >= 3 && n.startsWith(w)) || (n.length >= 4 && w.startsWith(n)) ? 8 : (w.length >= 4 && n.includes(w)) || (n.length >= 5 && w.includes(n)) ? 5 : 0;
  const { list, words, along: alongList } = nevoIdx();
  // Per typed word: the best fit in each product that has a fitting word (found through the index). Words come back
  // all the time ("brood", "kaas"), so the last 300 are remembered.
  const best = q.map(w => {
    let m = nevoWordMemo.get(w); if (m) return m;
    m = new Map(); for (const [n, ids] of words) { const f = fit(n, w); if (f) for (const i of ids) if ((m.get(i) || 0) < f) m.set(i, f); }
    if (nevoWordMemo.size >= 300) nevoWordMemo.delete(nevoWordMemo.keys().next().value);
    nevoWordMemo.set(w, m); return m;
  });
  const hits = new Set(); q.forEach((w, j) => { if (!NEVO_HOW.has(w)) best[j].forEach((_, i) => hits.add(i)); });   // only "gekookt" is not enough
  const scored = [];
  for (const i of [...hits].sort((a, b) => a - b)) {
    const e = list[i];
    let sc = 0; q.forEach((w, j) => { const b = best[j].get(i) || 0; sc += NEVO_HOW.has(w) ? Math.min(b, 2) : b; });
    sc += Math.max(0, ...q.map(w => fit(e.w[0], w))) / 3;   // the product itself, not just a word in its description
    scored.push([sc - e.x.name.length / 100, e.x, i]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  let top;
  if (max > 20) {
    // A meal of several things: the best 15 for every typed word first, so one word with many products ("brood")
    // doesn't push out the others ("melk"); then the rest by score.
    const pick = new Set();
    q.forEach((w, j) => { if (!NEVO_HOW.has(w)) scored.filter(a => best[j].has(a[2])).slice(0, 15).forEach(a => pick.add(a)); });
    top = [...scored.filter(a => pick.has(a)), ...scored.filter(a => !pick.has(a))].slice(0, max).sort((a, b) => b[0] - a[0]).map(a => a[1]);
  } else top = scored.slice(0, max).map(a => a[1]);
  if (!along) return top;
  return [...new Set([...top, ...alongList])];
}
/* The NEVO lines for a question: the products that fit (from), or the whole table (from === true). */
function nevoBlock(from){
  if (!NEVO || !from) return '';
  const list = from === true ? nevoList() : nevoCandidates(from).map(nevoLine).join('\n');
  return `NEVO-lijst: ${from === true ? 'de officiële Nederlandse voedingsmiddelentabel van het RIVM (die ook het Voedingscentrum gebruikt)' : 'de producten uit de officiële Nederlandse voedingsmiddelentabel van het RIVM (die ook het Voedingscentrum gebruikt) die bij deze beschrijving lijken te passen'}. Per regel: NEVO-code, naam (synoniem).\n${list}\n`;
}
const NEVO_REF = `Gebaseerd op gegevens uit NEVO online versie ${window.NEVO_VERSION || ''}, RIVM, Bilthoven en andere gegevensbronnen`;
/* A photo goes without the NEVO list (the whole table is tens of thousands of words for the AI to read, which made
   photos slow). The AI names each part with its preparation and estimates it; the app then finds the NEVO product
   itself. Only a product whose kcal per 100 g is close to the AI's estimate is taken (the name alone can mislead:
   "appel" also finds apple pie); otherwise the estimate stays and gets looked up like any other. */
const NEVO_GENERIC = new Set(['saus', 'soep', 'salade', 'dressing', 'gerecht', 'schotel', 'taart', 'snack', 'toetje', 'dessert', 'vlees', 'vis', 'groente', 'groenten', 'fruit', 'drank', 'drankje', 'hapje', 'bijgerecht', 'mix', 'huis', 'restaurant', 'zelfgemaakt', 'gebakken', 'gekookt', 'gegrild', 'gefrituurd', 'rauw']);
/* The NEVO product for a name and the AI's kcal per 100 g, or null. */
function nevoMatch(name, est, macros){
  if (!NEVO) return null;
  // Only a general word ("saus van het huis", "salade") says too little to pick a product: then the estimate stays.
  const words = foldText(name).split(/[^a-z0-9]+/).filter(w => w.length >= 2 && !NEVO_STOP.has(w));
  if (!words.some(w => !NEVO_GENERIC.has(w))) return null;
  // Of the 4 best names, the one closest to the AI's kcal per 100 g (a small extra for a better name), within 0.7–1.45×.
  // With the AI's protein, carbs and fat per 100 g as well: of the 8 best names, the one closest in make-up too
  // ("volkoren brood" then finds wholemeal bread, not the toastie made with it).
  const cands = nevoCandidates(name, macros ? 8 : 4, false);
  const away = n => macros ? (Math.abs(n.p - macros.p) + Math.abs(n.c - macros.c) + Math.abs(n.f - macros.f)) / 50 : 0;
  return (est == null ? cands[0] : cands.map((n, i) => [n, n.kcal > 0 ? Math.abs(Math.log(n.kcal / est)) + away(n) + i * (macros ? 0.02 : 0.04) : 9])
    .filter(([n]) => n.kcal > 0 && n.kcal / est >= 0.7 && n.kcal / est <= 1.45).sort((a, b) => a[1] - b[1]).map(a => a[0])[0]) || null;
}
function nevoGuess(it){
  if (it.nevo || it.off || !NEVO || !(it.grams > 0)) return it;
  const pick = nevoMatch(it.name, it.kcal > 0 ? it.kcal / it.grams * 100 : null);
  if (!pick) return it;
  it.nevo = pick.code; delete it.bron;
  return applyNevo(it);
}
/* An item with a NEVO code gets its numbers from the table, for its own weight. */
function applyNevo(it){
  const n = it.nevo && NEVO && NEVO.get(it.nevo); if (!n) { delete it.nevo; return it; }
  const g = it.grams > 0 ? it.grams : isMass(it.unit) ? it.qty : 0;
  if (!(g > 0)) { delete it.nevo; return it; }
  const q = it.qty || 1, per = v => v * g / 100;
  Object.assign(it, { grams: g, kcal: per(n.kcal), p: per(n.p), c: per(n.c), f: per(n.f), sf: n.sf == null ? null : per(n.sf), bron: 'NEVO', nevoName: n.name });
  delete it.fixed;
  it.base = { ...it.base, g: g / q, kcal: it.kcal / q, p: it.p / q, c: it.c / q, f: it.f / q, sf: it.sf != null ? it.sf / q : null };
  return it;
}
/* Items the table doesn't have: looked up, only those items. First in Open Food Facts (free, no AI and no limit: the
   package values of real products); what isn't there goes to Google Search when that is possible with your key (on
   the web, Voedingscentrum first). Google's values are used only when it really searched (sources came back);
   otherwise the AI's own estimate stays. */
// Not in the table, or only something close to it (kibbeling → lekkerbekje): those are looked up.
const webTodo = R => R ? R.items.filter(i => (!i.nevo || i.approx) && !i.off && i.grams > 0) : [];
let webFillKind = 'opzoeken';
async function webFill(R, only){
  const todo0 = only || webTodo(R);
  if (!todo0.length) return;
  aiStatus(`Ik zoek ${todo0.length === 1 ? todo0[0].name : todo0.length + ' onderdelen'} op…`);
  const t0 = Date.now();
  await offFill(R, todo0);
  const todo = todo0.filter(it => !it.off);
  if (!todo.length) return;
  // Google Search can't be used with this key (on the free tier only the 2.5 models may search): the estimate stays.
  // When Open Food Facts itself failed just now, that is not "not found": it is tried again later (see lookLater).
  if (!canSearch()) { const failed = offFailAt >= t0; todo.forEach(it => { it.lookNo = failed ? 'mislukt' : 'geen'; }); return; }
  aiStatus(`Ik zoek ${todo.length === 1 ? todo[0].name : todo.length + ' onderdelen'} op bij het Voedingscentrum…`);
  todo.forEach(it => { it.lookNo = 'niets'; });   // cleared again for what is found
  const prompt = `Zoek de voedingswaarden per 100 gram op van deze producten. Kijk eerst bij het Voedingscentrum (voedingscentrum.nl); staat het daar niet, dan bij de fabrikant of supermarkt (ah.nl, jumbo.nl, lidl.nl), en anders bij een andere betrouwbare Nederlandse bron. Let op de bereiding in de naam (rauw, gekookt, gebakken, gefrituurd).
${todo.map((it, i) => `${i + 1}. ${it.name}`).join('\n')}
Antwoord met alleen JSON: {"items":[{"nr":1,"kcal":0,"eiwit":0,"koolhydraten":0,"vet":0,"verzadigd":0,"bron":"Voedingscentrum"}]}
Kun je een product niet vinden, laat het dan weg.`;
  const why = c => c === 'search_off' || c === 'rate_limited' ? 'limiet' : c === 'model' || c === 'nosearch' ? 'kan niet' : 'mislukt';
  let res; try { res = await aiJSON(prompt, 25000, null, 0, null, true, webFillKind); }
  catch (e) { todo.forEach(it => { it.lookNo = e && e.code === 'quiet' ? 'limiet' : why(e && e.code); }); if (e && e.code === 'quiet') throw e; return; }
  const web = Array.isArray(res && res.__bronnen) ? res.__bronnen : [];
  if (!web.length) return;
  (Array.isArray(res.items) ? res.items : []).forEach(x => {
    const it = todo[num(x.nr) - 1]; if (!it) return;
    const k = num(x.kcal), pp = num(x.eiwit), cc = num(x.koolhydraten), ff = num(x.vet), macro = 4 * pp + 4 * cc + 9 * ff;
    if (!(k > 0) || (macro > 0 && Math.abs(k - macro) / Math.max(k, macro) > 0.35)) return;   // numbers that don't add up: keep the estimate
    const near = it.nevo && NEVO.get(it.nevo);   // the close NEVO product: a web value far from it is probably a different product
    if (near && near.kcal > 0 && (k < near.kcal / 2 || k > near.kcal * 2)) return;
    if (near) { delete it.nevo; delete it.nevoName; delete it.approx; }
    delete it.lookNo;
    const g = it.grams, q = it.qty || 1, per = v => v * g / 100;
    Object.assign(it, { kcal: per(k), p: per(pp), c: per(cc), f: per(ff), sf: x.verzadigd == null ? it.sf : per(num(x.verzadigd)), bron: webBron(x.bron, web) });
    delete it.fixed;
    it.base = { ...it.base, kcal: it.kcal / q, p: it.p / q, c: it.c / q, f: it.f / q, sf: it.sf != null ? it.sf / q : null };
  });
  R.sources = [...(R.sources || []), ...web].filter((x, i, a) => a.findIndex(y => y.title === x.title) === i).slice(0, 6);
}
/* Open Food Facts by name, for each part that NEVO doesn't have exactly (at most 4, it allows about 10 searches a
   minute). Only a clear match counts: most of the words of the part in the product's name or brand, the numbers on
   the package adding up (kcal ≈ 4×protein + 4×carbs + 9×fat), and per 100 g not far from what the AI or NEVO thought
   (a "kibbeling" search that finds kibbeling sauce is left alone). The part keeps its weight; the package values
   replace the estimate, with the product as source. */
const offFindMemo = new Map();
/* Shops in a name ("AH skyr perzik"): left out of the search (Open Food Facts knows AH as "Albert Heijn", and a shop
   word makes its text search find nothing), then a product of that shop gets the preference. */
const OFF_SHOP = { ah: 'heijn', albert: 'heijn', heijn: 'heijn', jumbo: 'jumbo', lidl: 'lidl', aldi: 'aldi', plus: 'plus', dirk: 'dirk', spar: 'spar', coop: 'coop', hoogvliet: 'hoogvliet', vomar: 'vomar', ekoplaza: 'ekoplaza' };
/* The products for some words, as fast as possible:
   1. asked before in the last 10 minutes: the same answer (also while it is still on its way);
   2. found before: kept on the phone (30 days; "nothing found" 2 days), so a food you log often needs no search at all;
   3. otherwise searched, at most 4 s (Open Food Facts itself answers in ± 0.2 s; a hanging search never holds you up).
   The Android app asks the Dutch and the worldwide list at the same time; the browser one after the other (it may only
   search about 10 times a minute). The words are the key in any order, so "skyr perzik" and "perzik skyr" are one search. */
const offKey = core => [...core].sort().join(' ');
let offFailAt = 0;   // when a search last failed (Open Food Facts down, or its limit): then nothing counts as "not found"
const OFF_NUT = ['energy-kcal_100g', 'energy-kj_100g', 'energy_100g', 'proteins_100g', 'carbohydrates_100g', 'fat_100g', 'saturated-fat_100g'];
const offKeep = h => ({ code: h.code, product_name: h.product_name, product_name_nl: h.product_name_nl, brands: h.brands,
  nutriments: Object.fromEntries(OFF_NUT.filter(k => h.nutriments && h.nutriments[k] != null && h.nutriments[k] !== '').map(k => [k, h.nutriments[k]])) });
function offHits(core){
  const key = offKey(core), q = core.join(' ');
  const m = offFindMemo.get(key); if (m && Date.now() - m.t < 600000) return m.p;
  const st = (S.meta.offFound || {})[key];
  if (st && st.h.length && Date.now() - st.t < 30 * 864e5) return Promise.resolve(st.h);
  const search = Native
    ? Promise.all([offSearch(q, 12, true, true), offSearch(q, 12, false, true).catch(() => [])]).then(([nl, all]) => nl.length ? nl : all)
    : offSearch(q, 12, true, true).then(h => h.length ? h : offSearch(q, 12, false, true));
  const p = Promise.race([search, sleep(4000).then(() => { throw { code: 'slow' }; })])
    .then(hits => {
      // Only what could match is kept (on the phone, so this stays small): products with values and most of the words.
      const keep = hits.filter(h => offHasEnergy(h.nutriments)).filter(h => { const have = new Set(offTokens(offName(h) + ' ' + (Array.isArray(h.brands) ? h.brands.join(' ') : h.brands || ''))), br = offTokens(Array.isArray(h.brands) ? h.brands.join(' ') : h.brands || ''), words = offTokens(offName(h)).filter(w => !br.includes(w)); return core.filter(w => have.has(w)).length / core.length >= 0.6 && words.filter(w => core.includes(w)).length / Math.max(1, words.length) >= 0.5; }).slice(0, 5).map(offKeep);
      if (keep.length) {   // what was found online is kept on the phone (the last 40); nothing found is only remembered for a few minutes
        const F = S.meta.offFound ||= {}; F[key] = { t: Date.now(), h: keep };
        const ks = Object.keys(F); if (ks.length > 40) ks.sort((a, b) => F[a].t - F[b].t).slice(0, ks.length - 40).forEach(x => delete F[x]);
      }
      return keep;
    })
    // A failed search (no connection, too slow, or too many searches in a minute) isn't remembered: next time it is tried again.
    .catch(() => { offFindMemo.delete(key); offFailAt = Date.now(); return []; });
  offFindMemo.set(key, { t: Date.now(), p }); if (offFindMemo.size > 60) offFindMemo.delete(offFindMemo.keys().next().value);
  return p;
}
/* Start the searches for what you typed right away, at the same time as the AI (or while you type, in the app): by the
   time the AI has named the parts, their products are usually already in. Up to 4 parts of the text. */
function offPrefetch(text){
  String(text || '').split(/,|;|\+|\n|\ben\b|\bmet\b/i).map(x => offTokens(x).filter(w => !OFF_SHOP[w])).filter(c => c.join(' ').length >= 3).slice(0, 4).forEach(c => { if (!offLocalHits(c).length) offHits(c); });
}
function offFind(name, est){
  const all = offTokens(name), core = all.filter(w => !OFF_SHOP[w]), shops = all.filter(w => OFF_SHOP[w]).map(w => OFF_SHOP[w]);
  if (core.join(' ').length < 3) return Promise.resolve(null);
  const pick = hits => hits.map(h => {
    const n = h.nutriments || {}, k = offKcal100(n), mac = 4 * num(n.proteins_100g) + 4 * num(n.carbohydrates_100g) + 9 * num(n.fat_100g);
    const brand = offTokens(Array.isArray(h.brands) ? h.brands.join(' ') : h.brands || ''), words = offTokens(offName(h));
    const have = new Set([...words, ...brand]), sc = core.filter(w => have.has(w)).length / core.length;
    // And the product must be mostly what you said: at least half of its own words ("rode kool met stukjes appel" is no apple).
    const pw = words.filter(w => !brand.includes(w)), own = pw.length ? pw.filter(w => core.includes(w)).length / pw.length : 0;
    const ok = (k > 0 || !(est > 20)) && sc >= 0.6 && own >= 0.5 && (!mac || Math.abs(k - mac) / Math.max(k, mac) <= 0.3) && (!(est > 20) || (k / est <= 1.6 && est / k <= 1.6));
    // The shop you named first; then the product with the fewest extra words ("pindakaas" before "proteïne pindakaas").
    const extra = words.filter(w => !core.includes(w) && !brand.includes(w)).length;
    return ok ? { h, rank: sc + (shops.length && shops.some(x => have.has(x)) ? 0.5 : 0) - 0.05 * extra - (est > 0 ? Math.abs(Math.log(k / est)) * 0.2 : 0) } : null; })
    .filter(Boolean).sort((a, b) => b.rank - a.rank)[0] || null;
  // First the list inside the app (instant, no internet); what isn't clearly in it goes online.
  const here = pick(offLocalHits(core));
  return here ? Promise.resolve(here) : offHits(core).then(pick);
}
function offInto(it, h){
  const n = h.nutriments || {}, g = it.grams, q = it.qty || 1, per = k => num(n[k]) * g / 100;
  Object.assign(it, { name: offName(h).slice(0, 80), kcal: offKcal100(n) * g / 100, p: per('proteins_100g'), c: per('carbohydrates_100g'), f: per('fat_100g'),
    sf: n['saturated-fat_100g'] != null && n['saturated-fat_100g'] !== '' ? per('saturated-fat_100g') : null, off: true, bron: 'Open Food Facts' });
  ['nevo', 'nevoName', 'approx', 'lookNo', 'fixed'].forEach(k => delete it[k]);
  it.base = { ...it.base, kcal: it.kcal / q, p: it.p / q, c: it.c / q, f: it.f / q, sf: it.sf != null ? it.sf / q : null };
}
async function offFill(R, todo){
  const list = todo.filter(it => it.grams > 0).slice(0, 8);   // the list in the app costs nothing; online searches are held back by their own limit
  const found = await Promise.all(list.map(it => offFind(it.name, it.kcal > 0 ? it.kcal / it.grams * 100 : null).catch(() => null)));
  found.forEach((f, i) => { if (!f) return; offInto(list[i], f.h);
    R.sources = [...(R.sources || []), { title: 'Open Food Facts', uri: `https://world.openfoodfacts.org/product/${encodeURIComponent(f.h.code || '')}` }]
      .filter((x, j, a) => a.findIndex(y => y.uri === x.uri) === j).slice(0, 6); });
}
/* The source of a looked-up value: one of the pages Google Search really used (the one the AI named, when it is among
   them), never a name the AI made up. */
const webBron = (b, web) => { const w = String(b || '').toLowerCase().split(/[\s.]/)[0]; return ((w && web.find(x => x.title.toLowerCase().includes(w))) || web[0]).title.slice(0, 40); };
/* Where the numbers come from: the pages Google Search used, or plainly that the AI estimated without looking it up. */
function sourcesHTML(R){
  if (!R || R.src === 'product' || R.src === 'manual') return '';
  const list = R.sources || [], nevo = (R.items || []).some(i => i.nevo) || R.bron === 'NEVO';
  const look = R.looking && R.looking.length ? `<br><span class="looking">🔎 Ik zoek ${R.looking.length === 1 ? esc(R.looking[0]) : R.looking.length + ' onderdelen'} nog op…</span>` : '';
  const est = look ? [] : (R.items || []).filter(i => !i.nevo && !i.off && (!i.bron || /^schatting/i.test(i.bron)));
  const reason = () => { const no = est.map(i => i.lookNo).find(Boolean);
    const cool = S.meta.ai.searchCool - Date.now();
    return cool > 0 || no === 'limiet' ? ` Het gratis opzoeken is even op${cool > 5 * 60000 ? `, weer mogelijk om ${new Date(S.meta.ai.searchCool).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}` : '; probeer het over een minuutje opnieuw'}.`
      : no === 'geen' ? ' Niet gevonden in Open Food Facts, en zoeken via Google kan niet met een gratis AI-sleutel.' : no === 'kan niet' ? ' Opzoeken lukt niet met de modellen van je AI-sleutel.' : no === 'niets' ? ' Er is niets betrouwbaars gevonden.' : no === 'mislukt' ? ' Het opzoeken lukte even niet; ik probeer het later vanzelf opnieuw.' : ''; };
  // Short: what is estimated, and only a reason when there is one that matters (the lookup limit, or it failed).
  const why = R.cached ? '' : reason();
  const estLine = est.length && R.src !== 'product' ? `≈ ${est.length === (R.items || []).length ? 'Schatting van AI' : `Schatting van AI: ${est.map(i => esc(i.name)).join(', ')}`}${/even op|lukte even niet/.test(why) ? '.' + why : ''}${S.meta.ai.key && R.items.some(i => i.lookNo) ? ` <button class="add-line" data-act="relook">Opnieuw opzoeken</button>` : ''}` : '';
  const parts = [nevo ? `📖 ${NEVO_REF}.` : '', list.length ? `🔎 Bronnen: ${list.map(x => `<a href="${esc(x.uri)}" target="_blank" rel="noopener">${esc(x.title)}</a>`).join(', ')}` : '', estLine].filter(Boolean);
  return parts.length || look ? `<p class="note srcline">${parts.join('<br>')}${look}</p>` : '';
}
/* How much you ate, in words: what was filled in, plus the usual sizes of this food (a standard portion, a tub,
   the whole pack) from the AI or the package. Without those: a small, a large and a double portion. */
function portionOptions(R){
  const G = (R.items || []).reduce((a, i) => a + (i.grams || 0), 0), m = R.mult || 1;
  const opts = [{ label: `Zoals ingevuld${G ? ` (${r0(G)} g)` : ''}`, f: 1 }];
  (R.portions || []).forEach(p => {
    if (!(G > 0) || !(p.grams > 0)) return;
    const f = Math.round(p.grams / G * 100) / 100, label = /\d\s*(g|ml)\b/i.test(p.label) ? p.label : `${p.label} (${r0(p.grams)} ${p.unit || 'g'})`;
    const same = opts.find(o => Math.abs(o.f - f) < 0.04);
    if (same) { if (same.f === 1 && same.label.startsWith('Zoals ingevuld')) same.label = label; return; }   // e.g. "Standaardportie (150 g)"
    if (f < 0.1 || f > 8) return;
    opts.push({ label, f });
  });
  if (opts.length === 1) opts.push({ label: 'Kleine portie', f: 0.5 }, { label: 'Grote portie', f: 1.5 }, { label: 'Dubbele portie', f: 2 });
  if (!opts.some(o => Math.abs(o.f - m) < 0.005)) opts.push({ label: `${fmtQty(m)} × zoals ingevuld`, f: m });
  return opts.sort((a, b) => a.f - b.f).slice(0, 7);
}
const normPortions = arr => (Array.isArray(arr) ? arr : []).slice(0, 4)
  .map(p => ({ label: String(p.naam ?? p.label ?? '').replace(/\s*\([^)]*\)\s*/g, ' ').trim().slice(0, 30).replace(/^./, c => c.toUpperCase()), grams: num(p.gram ?? p.grams), unit: p.unit }))
  .filter(p => p.label && p.grams > 0);
function analysisPrompt(text, nevoFrom = text){
  // Everything that is the same every time comes first, so Google can reuse that part and answer sooner.
  // Your own habits and description come last.
  const prefs = String(S.meta.aiPrefs || '').trim();
  return `Je bent een nauwkeurige voedingsdeskundige in een Nederlandse calorie-tracker app. Antwoord in het Nederlands.
De gebruiker beschrijft wat hij of zij heeft gegeten of gedronken. Splits het in losse onderdelen en schat realistische Nederlandse porties als er geen hoeveelheid genoemd wordt (bv. 1 boterham = 35 g, 1 plak kaas = 20 g, 1 el olie = 10 g, 1 glas = 200 ml).
Geef bij elk onderdeel de hoeveelheid zoals je het zou vertellen: een aantal met een eenheid, bv. 2 boterham, 2 plak, 1 glas, 1 kop, 1 stuk, 1 eetlepel, 1 schaaltje, 1 bord, 1 handje, 1 portie. Gebruik alleen "g" of "ml" (aantal = het aantal gram of ml) als er geen logische eenheid is, zoals bij losse rijst of yoghurt uit een grote bak.
Richtlijnen:
- Hoeveelheid en maat van de gebruiker gaan altijd voor. Noemt de gebruiker een hoeveelheid (bv. "300 gram", "2 stuks", "een bakje van 500 g", "een halve pizza"), gebruik die precies: "300 gram kibbeling" is samen 300 g kibbeling. Noemt de gebruiker een maat, pas de standaardportie daarop aan: "groot", "flink", "grote portie" of "extra" ≈ 1,5× de standaardportie; "klein", "kleine portie" of "een beetje" ≈ 0,6×; "half" = 0,5×. Zet dan in "porties" ook de standaardportie, zodat de gebruiker kan wisselen.
- nevo: zoek per onderdeel in de NEVO-lijst hieronder het product dat er het best bij past: hetzelfde product en dezelfde bereiding (rauw, gekookt, gebakken, gefrituurd). Zet de code bij "nevo". De app rekent dan zelf de kcal en macro's uit voor het aantal gram; "gram" moet dan wel kloppen (bij dranken: ml). Geef ook dan je eigen kcal, eiwit, koolhydraten en vet: die gebruikt de app als controle of de code klopt. Staat het product er niet precies in, kies dan een dichtbijliggend product dat nagenoeg hetzelfde is (bv. kibbeling ≈ lekkerbekje gefrituurd) en zet er "benadering":true bij; de app zoekt het dan nog op bij het Voedingscentrum. Is het hetzelfde product, laat "benadering" weg.
- Eén product blijft één onderdeel: een product met een smaak of variant (bv. "skyr perziksmaak", "aardbeienyoghurt", "kwark vanille") is één onderdeel, niet "skyr" plus losse stukjes perzik. Kies dan de NEVO-variant met vruchten of smaak, nooit de naturel-variant. Noemt de gebruiker een merk of winkel (AH, Jumbo, Lidl ...) of een smaak, zet dan "benadering":true bij de NEVO-code: de app zoekt het product dan nog op.
- Kies alleen een NEVO-code als het echt hetzelfde soort product is (dezelfde naam of een gewoon synoniem). Twijfel je, laat "nevo" dan weg: een verkeerde code is erger dan een eigen schatting.
- Zonder passende NEVO-code (merkproduct, restaurantgerecht, iets dat er echt niet in staat): laat "nevo" weg en geef zelf kcal, eiwit, koolhydraten, vet en verzadigd, zo nauwkeurig mogelijk met Nederlandse waarden (merk genoemd? dan dat merk), met "bron":"schatting". Verzin geen bron: je zoekt hier niets op.
- Geef bij dezelfde beschrijving steeds dezelfde porties en waarden.
- Verborgen kcal worden vaak vergeten. Tel bereidingsvet (olie, boter bij bakken, wokken, roerbakken, gebakken ei, gebakken aardappels), boter of halvarine op brood, sauzen, dressing, mayonaise en suiker in dranken mee als apart onderdeel wanneer dat aannemelijk is, met "verborgen":true. Bij restaurant, afhaal of snackbar: eerder iets te hoog dan te laag schatten.
- Twijfel je, en zou één antwoord de kcal met meer dan 20% veranderen (bv. de portiegrootte, of er saus bij zat)? Geef dan toch je beste schatting, en voeg "vraag" toe met één korte vraag en 2 tot 4 korte antwoordopties.
- verzadigd: hoeveel gram van het vet verzadigd vet is (dus nooit meer dan vet).
- gram, kcal, eiwit, koolhydraten, vet en verzadigd gelden voor het hele aantal van dat onderdeel (niet per stuk en niet per 100 g).
- Bij eigen schattingen: controleer kcal ≈ 4×eiwit + 4×koolhydraten + 9×vet (±15%).
- score: voedingskwaliteit van 1 (ongezond) tot 10 (heel voedzaam, veel eiwit/vezels/groente).
- vocht_ml: alleen bij een drank (water, koffie, thee, melk, sap, frisdrank, soep): hoeveel ml vocht. Een kop koffie is ± 125 ml, een mok 250 ml. Niet bij alcohol.
- porties: alleen als het om één hoofdproduct of één gerecht gaat: 2 tot 4 gangbare hoeveelheden waarin het meestal gegeten of verkocht wordt (bv. "standaardportie", "1 bakje", "1 schaaltje", "1 bord", "portie van de snackbar", "hele verpakking"), elk met het totaal aantal gram. Laat weg bij een maaltijd van meerdere losse dingen.
- titel: kort, met de woorden van de gebruiker. Laat aantallen en details als percentages, merken en gewichten weg ("2 boterhammen met 100% pindakaas" → "Boterhammen met pindakaas"), maar plak geen woorden aan elkaar en verzin geen nieuwe samenstellingen (dus niet "Pindakaasbrood").
- Houd het antwoord kort: laat "vocht_ml", "verborgen", "porties" en "vraag" weg als ze niet van toepassing zijn. tip: hooguit 12 woorden.
Antwoord met alleen JSON in deze vorm:
{"titel":"korte naam","emoji":"🍞","items":[{"naam":"Volkoren brood","aantal":2,"eenheid":"boterham","eenheid_mv":"boterhammen","gram":70,"nevo":246,"kcal":165,"eiwit":7,"koolhydraten":28,"vet":2},{"naam":"Saus van het huis","aantal":1,"eenheid":"bakje","eenheid_mv":"bakjes","gram":30,"kcal":120,"eiwit":0.5,"koolhydraten":4,"vet":11,"verzadigd":1,"bron":"schatting","verborgen":true}],"zekerheid":"hoog|middel|laag","score":7,"tip":"korte zin","porties":[{"naam":"1 bakje","gram":450}],"vraag":{"tekst":"alleen bij twijfel","opties":["optie 1","optie 2"]}}
Gaat de tekst niet over eten of drinken, antwoord dan: {"geen_eten":true,"reden":"korte uitleg"}

${nevoBlock(nevoFrom)}${prefs ? `\nVaste gewoontes van deze gebruiker (gebruik ze, tenzij de beschrijving iets anders zegt):\n${prefs.slice(0, 600)}\n` : ''}
Beschrijving: """${text.slice(0, 1500)}"""`;
}
/* 4. The shape of the food answer, so Google itself makes sure it is valid JSON in this form. */
const FOOD_ITEM_KEYS = ['naam', 'aantal', 'eenheid', 'eenheid_mv', 'gram', 'nevo', 'benadering', 'kcal', 'eiwit', 'koolhydraten', 'vet', 'verzadigd', 'vocht_ml', 'verborgen', 'bron'];
const FOOD_SCHEMA = { type: 'OBJECT', propertyOrdering: ['geen_eten', 'reden', 'titel', 'emoji', 'items', 'zekerheid', 'score', 'tip', 'porties', 'vraag'], properties: {
  geen_eten: { type: 'BOOLEAN' }, reden: { type: 'STRING' }, titel: { type: 'STRING' }, emoji: { type: 'STRING' },
  items: { type: 'ARRAY', items: { type: 'OBJECT', propertyOrdering: FOOD_ITEM_KEYS, required: ['naam', 'aantal', 'eenheid', 'gram', 'kcal', 'eiwit', 'koolhydraten', 'vet'],
    properties: Object.fromEntries(FOOD_ITEM_KEYS.map(k => [k, { type: ['verborgen', 'benadering'].includes(k) ? 'BOOLEAN' : ['naam', 'eenheid', 'eenheid_mv', 'bron'].includes(k) ? 'STRING' : k === 'nevo' ? 'INTEGER' : 'NUMBER' }])) } },
  porties: { type: 'ARRAY', items: { type: 'OBJECT', properties: { naam: { type: 'STRING' }, gram: { type: 'NUMBER' } }, required: ['naam', 'gram'] } },
  zekerheid: { type: 'STRING', enum: ['hoog', 'middel', 'laag'] }, score: { type: 'INTEGER' }, tip: { type: 'STRING' },
  vraag: { type: 'OBJECT', properties: { tekst: { type: 'STRING' }, opties: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['tekst', 'opties'] } } };

/* The shape of the "Kan dit?" answer and of the ideas, so Google itself returns valid JSON in that form (fewer failed
   answers that have to be asked again at another model). */
const FIT_SCHEMA = { type: 'OBJECT', properties: Object.fromEntries([
  ...['maaltijd', 'naam', 'portie', 'bron', 'alternatief'].map(k => [k, { type: 'STRING' }]),
  ...['gram', 'kcal', 'eiwit', 'koolhydraten', 'vet', 'verzadigd'].map(k => [k, { type: 'NUMBER' }]),
  ['score', { type: 'INTEGER' }], ['nevo', { type: 'INTEGER' }], ['benadering', { type: 'BOOLEAN' }], ['geen_eten', { type: 'BOOLEAN' }]]),
  // kcal and grams always: with only optional fields the AI sometimes gave just a NEVO code without grams, and then
  // there was nothing to work out ("Ik kon dit niet goed inschatten").
  required: ['naam', 'portie', 'gram', 'kcal', 'eiwit', 'koolhydraten', 'vet'],
  propertyOrdering: ['geen_eten', 'maaltijd', 'naam', 'portie', 'gram', 'nevo', 'benadering', 'kcal', 'eiwit', 'koolhydraten', 'vet', 'verzadigd', 'score', 'bron', 'alternatief'] };
const LABEL_SCHEMA = { type: 'OBJECT', properties: { onleesbaar: { type: 'BOOLEAN' }, reden: { type: 'STRING' }, naam: { type: 'STRING' }, merk: { type: 'STRING' },
  per: { type: 'STRING' }, kcal: { type: 'NUMBER' }, eiwit: { type: 'NUMBER' }, koolhydraten: { type: 'NUMBER' }, vet: { type: 'NUMBER' }, verzadigd: { type: 'NUMBER' },
  portie_gram: { type: 'NUMBER' }, inhoud: { type: 'STRING' } } };
const SCORE_SCHEMA = { type: 'OBJECT', properties: { gerechten: { type: 'ARRAY', items: { type: 'OBJECT', properties: { i: { type: 'INTEGER' }, score: { type: 'INTEGER' }, verzadigd_pct: { type: 'NUMBER' } }, required: ['i', 'score'] } } }, required: ['gerechten'] };
const NUTR = Object.fromEntries(['kcal', 'eiwit', 'koolhydraten', 'vet', 'verzadigd'].map(k => [k, { type: 'NUMBER' }]));
const IDEAS_SCHEMA = { type: 'OBJECT', properties: { samenvatting: { type: 'STRING' }, ideeen: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
  // No totals per idea: Knabbel adds up the ingredients itself, so the AI writes less and the ideas come in sooner.
  naam: { type: 'STRING' }, portie: { type: 'STRING' }, soort: { type: 'STRING', enum: ['snack', 'maaltijd'] }, moeite: { type: 'STRING' },
  score: { type: 'INTEGER' }, prijs: { type: 'NUMBER' }, waarom: { type: 'STRING' }, bereiding: { type: 'STRING' },
  ingredienten: { type: 'ARRAY', items: { type: 'OBJECT', properties: { naam: { type: 'STRING' }, gram: { type: 'NUMBER' }, verpakking: { type: 'STRING' }, ...NUTR }, required: ['naam', 'gram', 'kcal', 'eiwit', 'koolhydraten', 'vet'] } } },
  required: ['naam', 'ingredienten'] } } }, required: ['ideeen'] };

/* ---------- scores for meals that have none yet ---------- */
/* Meals without a score (typed in yourself, or from before) get one in the background: one AI question for up to
   40 different dishes, at most every 20 minutes and only when there is something to do. The same dish gets the same
   score everywhere, also in your favourites. Dishes the AI skips are tried again at most once a day. */
const scoreKey = n => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');
let scoreFillBusy = false;
async function backfillScores(){
  if (scoreFillBusy || !S.profile || !S.meta.ai.key || (Native && navigator.onLine === false)) return;
  if (Date.now() - (S.meta.scoreFillAt || 0) < 20 * 60000) return;
  if (Date.now() - aiUserAt < 90000) { setTimeout(backfillScores, 95000); return; }
  const from = shiftKey(todayKey(), -120), tried = S.meta.scoreTried || {}, dishes = new Map();
  Object.keys(S.days).filter(k => k >= from).sort().reverse().forEach(k => (S.days[k].entries || []).forEach(e => {
    if (e.pending || !(e.kcal > 0) || !needsFill(e)) return;
    const key = scoreKey(e.name); if (!key || tried[key] === todayKey() || dishes.has(key)) return;
    dishes.set(key, e);
  }));
  const list = [...dishes.entries()].slice(0, 40); if (!list.length) return;
  scoreFillBusy = true; S.meta.scoreFillAt = Date.now(); save();
  try {
    const got = await scoreDishes(list);
    list.forEach(([key, e]) => { if (needsFill(e)) tried[key] = todayKey(); });
    S.meta.scoreTried = Object.fromEntries(Object.entries(tried).filter(([, d]) => d >= shiftKey(todayKey(), -7)));
    save(); if (got.size && !sheetOpen()) render();
  } catch (e) { /* no connection or no AI right now: next time */ }
  scoreFillBusy = false;
}
const scoreFillSoon = () => setTimeout(backfillScores, 4000);
/* What a meal still misses: a score, or saturated fat while it does have fat. */
const needsFill = e => !e.score || (e.sf == null && (e.f || 0) >= 1);
/* Saturated fat as a share of the fat, so it fits every portion of the same dish. Parts without it get the same share;
   parts that already have it keep theirs. */
function fillSat(e, pct){
  if (e.sf != null || !((e.f || 0) >= 1)) return false;
  (e.items || []).forEach(i => { if (i.sf == null) i.sf = r1((i.f || 0) * pct / 100); });
  e.sf = e.items && e.items.length ? r1(e.items.reduce((a, i) => a + (i.sf || 0), 0) * (e.mult || 1)) : r1(e.f * pct / 100);
  return true;
}
/* Asks the AI, for [key, {name, kcal, p, c, f}] pairs, a score and how much of the fat is saturated, and gives that to
   every meal and favourite with the same name. One question for the whole list. Returns key -> {score, pct}. */
async function scoreDishes(list, maxMs = 45000){
  const prompt = `Je bent een voedingsdeskundige in een Nederlandse calorie-app. Geef voor elk gerecht hieronder:
- score: de voedingskwaliteit van 1 (ongezond) tot 10 (heel voedzaam, veel eiwit/vezels/groente, weinig suiker of bewerkt eten);
- verzadigd_pct: welk deel van het vet verzadigd vet is, in procent (boter, kaas, vet vlees, koek: hoog; olijfolie, noten, vis: laag).
Kijk naar wat het is én naar de getallen.
${list.map(([, e], i) => `${i}. ${String(e.name).slice(0, 80)} (${r0(e.kcal)} kcal, eiwit ${r0(e.p || 0)} g, koolhydraten ${r0(e.c || 0)} g, vet ${r0(e.f || 0)} g)`).join('\n')}
Antwoord met alleen JSON: {"gerechten":[{"i":0,"score":7,"verzadigd_pct":35}]}`;
  const res = await aiJSON(prompt, maxMs, SCORE_SCHEMA, 0, null, false, 'score'), got = new Map();
  (Array.isArray(res?.gerechten) ? res.gerechten : Array.isArray(res?.scores) ? res.scores : []).forEach(x => {
    const it = list[Number(x.i)]; if (!it) return;
    const sc = clamp(r0(x.score), 1, 10) || null, pct = x.verzadigd_pct != null && x.verzadigd_pct !== '' ? clamp(num(x.verzadigd_pct), 0, 100) : null;
    if (sc || pct != null) got.set(it[0], { score: sc, pct });
  });
  if (got.size) {
    const apply = o => { const g = got.get(scoreKey(o.name)); if (!g) return; if (!o.score && g.score) o.score = g.score; if (g.pct != null) fillSat(o, g.pct); };
    Object.values(S.days).forEach(d => (d.entries || []).forEach(e => { if (!e.pending) apply(e); }));
    (S.meta.favs || []).forEach(f => { const t = f.items ? itemsTotals(f.items.map(mkItem), f.mult || 1) : null; if (t && f.f == null) f.f = t.f; apply(f); });
  }
  return got;
}
/* The button in the edit sheet: a score for just this dish, right now. */
async function scoreNow(){
  const cur = L; if (!cur || !cur.result || cur.scoreBusy) return;
  const R = cur.result, name = (($('#r-title') || {}).value || R.title || '').trim(), t = itemsTotals(R.items, R.mult || 1), key = scoreKey(name);
  if (!key) return;
  cur.scoreBusy = true; renderSheet();
  try {
    const got = await scoreDishes([[key, { name, ...t }]], 30000), g = got.get(key);
    if (g) {
      if (!R.score && g.score) R.score = g.score;
      if (g.pct != null) R.items.forEach(i => { if (i.sf == null) { i.sf = (i.f || 0) * g.pct / 100; if (i.base) i.base.sf = i.sf / (i.qty || 1); } });
      const nt = itemsTotals(R.items, R.mult || 1);
      save(); toast([R.score ? `Voedzaam: ${R.score}/10` : '', nt.sf != null ? `verzadigd vet ${nt.sf.toFixed(1).replace('.', ',')} g` : ''].filter(Boolean).join(' · '));
    } else toast('Dat lukte nu niet. Knabbel probeert het later vanzelf nog eens.');
  } catch (e) { toast(e && e.code === 'no_key' ? 'Zet eerst de AI aan in Instellingen.' : 'Dat lukte nu niet. Knabbel probeert het later vanzelf nog eens.'); }
  cur.scoreBusy = false;
  if (L === cur) { if (R.title !== name) R.title = name; renderSheet(); }
  if (!sheetOpen()) render();
}

