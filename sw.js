// Kassensturz Service Worker: App offline verfügbar machen und geteilte Bilder annehmen.
const VERSION = 'kassensturz-v2.2.0';
const RUNTIME = 'kassensturz-runtime';
const SHARE = 'kassensturz-share';
const SHELL = ['./', './index.html', './app.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './icon-photo-192.png', './icon-text-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => ![VERSION, RUNTIME, SHARE].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Teilen aus Galerie / Google Lens: Bild oder Text zwischenspeichern, dann App öffnen
  if (req.method === 'POST' && url.origin === location.origin && url.pathname.endsWith('/share')) {
    e.respondWith((async () => {
      try {
        const form = await req.formData();
        const c = await caches.open(SHARE);
        const file = form.get('image');
        const text = [form.get('title'), form.get('text')].filter(Boolean).join('\n');
        if (file && typeof file !== 'string') await c.put('shared-image', new Response(file, { headers: { 'content-type': file.type || 'image/jpeg' } }));
        if (text) await c.put('shared-text', new Response(text));
      } catch (err) { /* nichts geteilt */ }
      return Response.redirect(new URL('./?shared=1#beleg', self.registration.scope).href, 303);
    })());
    return;
  }

  if (req.method !== 'GET') return;

  // App-Seite: erst Netz (für Updates), sonst aus dem Speicher
  if (req.mode === 'navigate' && url.origin === location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Alles andere (Icons, Schriften, Texterkennung): erst Speicher, sonst Netz und merken
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        const target = url.origin === location.origin ? VERSION : RUNTIME;
        caches.open(target).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});
