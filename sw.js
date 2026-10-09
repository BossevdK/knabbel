/* Knabbel web version: keeps its files on the phone, so the app also opens without internet.
   - The page itself: always fresh from the internet when there is a connection, the saved copy when there isn't.
   - css/js/fonts/icons: from the saved copy. Their links carry the version (?v=...), so a new version means new
     links, which are fetched and saved; the files of older versions are then removed.
   - Nothing from other sites (Google's AI, Open Food Facts): those always go over the internet. */
const CACHE = 'knabbel';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    const key = self.registration.scope;
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
      return r;
    }).catch(() => caches.match(key).then(hit => hit || Response.error())));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy).then(() => prune(c, url))); }
    return r;
  })));
});
/* A file of a newer version came in: the saved files of other versions are no longer needed. */
async function prune(cache, url){
  const v = url.searchParams.get('v'); if (!v) return;
  for (const req of await cache.keys()) {
    const o = new URL(req.url).searchParams.get('v');
    if (o && o !== v) await cache.delete(req);
  }
}
