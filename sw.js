/* Offline support. Only this app's own files are cached. Requests to AI providers are never touched. */
const VERSION = 'ld-v1.1.0';
const CORE = ['./', 'index.html', 'privacy.html', 'css/app.css', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png',
  'js/app.js', 'js/store.js', 'js/util.js', 'js/charts.js', 'js/ui.js', 'js/model.js', 'js/categories.js', 'js/importers.js', 'js/insights.js',
  'js/tax.js', 'js/ai.js', 'js/ask.js', 'js/voice.js', 'js/sheets.js', 'js/demo.js', 'js/wizard.js', 'js/embed.js',
  'js/views/briefing.js', 'js/views/personal.js', 'js/views/business.js', 'js/views/tax.js', 'js/views/whatif.js', 'js/views/data.js'];

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // network first so everyone gets the latest version; the cache keeps it working offline
  e.respondWith(caches.open(VERSION).then(async c => {
    try {
      const r = await Promise.race([fetch(e.request), new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 4000))]);
      if (r.ok) c.put(e.request, r.clone()); return r;
    } catch {
      return (await c.match(e.request, { ignoreSearch: true })) || (e.request.mode === 'navigate' ? c.match('index.html') : Response.error());
    }
  }));
});
