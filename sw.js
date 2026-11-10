// Kassensturz Service Worker: App offline verfügbar machen, Updates zuverlässig laden, geteilte Bilder annehmen.
// Bei jeder neuen Version hochzählen (zusammen mit version.json und APP_VERSION in app.js).
const VERSION = 'kassensturz-v2.4.0';
const RUNTIME = 'kassensturz-runtime';
const SHARE = 'kassensturz-share';
const SHELL = ['./', './index.html', './app.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './icon-photo-192.png', './icon-text-192.png'];
const NET_TIMEOUT = 3500;

self.addEventListener('install', e => {
  // cache: 'reload' umgeht den Browser-Zwischenspeicher, damit wirklich die neuen Dateien geladen werden
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => ![VERSION, RUNTIME, SHARE].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Erst Netz (neueste Version), bei Funkloch nach kurzer Zeit aus dem Speicher
function networkFirst(doFetch, cacheKey) {
  return new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done) { done = true; resolve(r); } };
    const fromCache = () => caches.match(cacheKey).then(hit => { if (hit) finish(hit); return hit; });
    const timer = setTimeout(fromCache, NET_TIMEOUT);
    doFetch().then(res => {
      clearTimeout(timer);
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(cacheKey, copy)); }
      finish(res);
    }).catch(() => {
      clearTimeout(timer);
      fromCache().then(hit => finish(hit || Response.error()));
    });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  const same = url.origin === location.origin;

  // Teilen aus Galerie / Google Lens: Bild oder Text zwischenspeichern, dann App öffnen
  if (req.method === 'POST' && same && url.pathname.endsWith('/share')) {
    e.respondWith((async () => {
      try {
        const form = await req.formData();
        const c = await caches.open(SHARE);
        const file = form.get('image');
        const text = [form.get('title'), form.get('text')].filter(Boolean).join('\n');
        if (file && typeof file !== 'string') await c.put('shared-image', new Response(file, { headers: { 'content-type': file.type || (/\.pdf$/i.test(file.name || '') ? 'application/pdf' : 'image/jpeg') } }));
        if (text) await c.put('shared-text', new Response(text));
      } catch (err) { /* nichts geteilt */ }
      return Response.redirect(new URL('./?shared=1#beleg', self.registration.scope).href, 303);
    })());
    return;
  }

  if (req.method !== 'GET') return;

  // Versionsprüfung immer direkt beim Server
  if (same && url.pathname.endsWith('/version.json')) return;

  // App-Seite
  if (req.mode === 'navigate' && same) {
    e.respondWith(networkFirst(() => fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }), './index.html'));
    return;
  }

  // Programmcode und Manifest: ebenfalls erst Netz, damit Updates sofort greifen
  if (same && /\.(js|webmanifest|html)$/.test(url.pathname)) {
    e.respondWith(networkFirst(() => fetch(new Request(req, { cache: 'no-cache' })), req));
    return;
  }

  // Icons und Texterkennung: erst Speicher, sonst Netz und merken
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(same ? VERSION : RUNTIME).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});
