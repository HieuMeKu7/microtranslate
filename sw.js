const CACHE = 'microtranslate-gh-v2.5';
const SHELL = [
  './',
  './index.html',
  './styles.css?v=2.5',
  './ai-byok.css?v=2.5',
  './app.js?v=2.5',
  './ai.js?v=2.5',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const u = new URL(request.url);

  // Never interfere with live API traffic or any third-party BYOK endpoint.
  if (request.method !== 'GET' || u.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
