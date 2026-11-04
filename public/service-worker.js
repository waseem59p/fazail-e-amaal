/* ============================================================
   Service Worker — فضائلِ اعمال PWA
   Offline caching for HTML, PDF, icons, PDF.js
   ============================================================ */

const CACHE_VERSION = 'fazail-v1.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const PDF_CACHE = `pdf-${CACHE_VERSION}`;
const CDN_CACHE = `cdn-${CACHE_VERSION}`;

/* Files jo pehli baar install par cache hongi */
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.ico',
  './favicon.svg',
  './favicon-96x96.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

/* PDF alag cache me — bara file hai */
const PDF_URLS = [
  './fazail.pdf'
];

/* CDN URLs (PDF.js) */
const CDN_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

/* ============================================================
   INSTALL — sab kuch cache karo
   ============================================================ */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing…');
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)),
      caches.open(PDF_CACHE).then((cache) =>
        Promise.all(
          PDF_URLS.map((url) =>
            cache.add(url).catch((err) => console.warn('[SW] PDF cache failed:', url, err))
          )
        )
      ),
      caches.open(CDN_CACHE).then((cache) =>
        Promise.all(
          CDN_URLS.map((url) =>
            fetch(url, { mode: 'cors' })
              .then((res) => cache.put(url, res))
              .catch((err) => console.warn('[SW] CDN cache failed:', url, err))
          )
        )
      )
    ])
    .then(() => self.skipWaiting())
    .catch((err) => console.error('[SW] Install failed:', err))
  );
});

/* ============================================================
   ACTIVATE — purane caches clean karo
   ============================================================ */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating…');
  const KEEP = [STATIC_CACHE, PDF_CACHE, CDN_CACHE];
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => (KEEP.includes(key) ? null : caches.delete(key)))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ============================================================
   FETCH — cache first, network fallback
   ============================================================ */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  /* Sirf GET requests */
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* PDF — cache-first (bara file, offline chahiye) */
  if (url.pathname.endsWith('.pdf')) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetchAndCache(req, PDF_CACHE))
    );
    return;
  }

  /* CDN (PDF.js) — cache-first */
  if (url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetchAndCache(req, CDN_CACHE))
    );
    return;
  }

  /* GitHub Releases (APK) — network only, cache nahi */
  if (url.hostname === 'github.com' || url.hostname === 'objects.githubusercontent.com') {
    return; // browser default
  }

  /* Apni site — network-first, fallback cache */
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  /* Baaki — cache-first */
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).catch(() => cached))
  );
});

/* ============================================================
   Helper: fetch + cache
   ============================================================ */
function fetchAndCache(request, cacheName) {
  return fetch(request)
    .then((res) => {
      if (res && res.status === 200) {
        const clone = res.clone();
        caches.open(cacheName).then((cache) => cache.put(request, clone));
      }
      return res;
    })
    .catch(() =>
      new Response('Offline — file cache me nahi hai', {
        status: 503,
        statusText: 'Offline',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    );
}

/* ============================================================
   MESSAGE — client se message (optional)
   ============================================================ */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
});