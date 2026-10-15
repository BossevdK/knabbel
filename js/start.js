/* Boot: runs last, when every other file is loaded. */
/* ---------- boot ---------- */
load();
applyTheme();
// Before anything changes today (the AI, Health Connect, you): today's restore point holds the state as it was.
snapshotToday();
if (S.profile) { applyStepsChoice(); retarget(); updateBurn(); }   // steps read before the choice existed get it too
render();
if (S.profile) {
  refreshHealth(Array.from({ length: 7 }, (_, i) => shiftKey(todayKey(), -i)));
  scheduleReminder();
  setTimeout(maybePromptCheckin, 600);
  setTimeout(processPending, 2500);
  setTimeout(backfillScores, 9000);
  setTimeout(lookLater, 15000);
  syncReminder();
  if (S.meta.fast.start && S.meta.fast.start + S.meta.fast.goal * 3.6e6 > Date.now()) fastNotify();
}
if (Native) nat('app.version').then(v => {
  APPV = { code: Number(v.code) || 0, name: String(v.name || ''), repo: String(v.repo || '') };
  if (S.meta.update && S.meta.update.code <= APPV.code) { delete S.meta.update; save(); }  // just updated
  if (!sheetOpen()) render();
  if (S.profile) setTimeout(checkUpdate, 4000);
}).catch(() => {});
if (Native && S.meta.health.on) nat('health.status').then(st => {
  if (st.sdk !== 'available') healthStatus = st.sdk;
  else if (st.missing && st.missing.length) { healthMissing = true; if (!sheetOpen()) render(); }
}).catch(() => {});
