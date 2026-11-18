// Keeps the app itself on the phone so it opens with no signal. Data is kept offline by Firestore.
// To release a change: bump VERSION here and in js/version.js (a test checks they match).
const VERSION = '0.1.0';
const CACHE = `dep-${VERSION}`;
const RUNTIME = 'dep-runtime'; // Firebase SDK and fonts, versioned by their own URLs

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/admin.js',
  'js/app.js',
  'js/config.js',
  'js/counter.js',
  'js/db.js',
  'js/logic.js',
  'js/screens.js',
  'js/strings.js',
  'js/ui.js',
  'js/version.js',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon.svg',
  'icons/maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== RUNTIME).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => { if (e.data === 'skip') self.skipWaiting(); });

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Firestore and Auth traffic is never cached here.
  if (url.hostname.endsWith('googleapis.com') && !url.hostname.startsWith('fonts')) return;
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
    return;
  }
  if (url.hostname === 'www.gstatic.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(RUNTIME).then(async (c) => {
      const hit = await c.match(e.request);
      const fresh = fetch(e.request).then((r) => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }).catch(() => hit);
      return hit || fresh;
    }));
  }
});
