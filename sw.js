const CACHE_NAME = 'suibo-training-v78';
const APP_ASSETS = [
  './',
  './index.html',
  './styles.css?v=20260915-4',
  './app.js?v=20260915-4',
  './modules/time.js?v=20260901-22',
  './modules/storage.js?v=20260901-24',
  './modules/editor-storage.js?v=20260901-29',
  './modules/audio.js?v=20260901-25',
  './modules/shelter-terrain.js?v=20260908-2',
  './modules/flood-spread.js?v=20260902-3',
  './modules/terrain-elevation.js?v=20260902-1',
  './modules/atmosphere.js?v=20260908-2',
  './modules/character-motion.js?v=20260904-1',
  './modules/camera-geometry.js?v=20260915-2',
  './modules/completion-presentation.js?v=20260908-1',
  './modules/water-effects.js?v=20260915-2',
  './modules/route-presentation.js?v=20260915-1',
  './modules/shelter-landmark.js?v=20260908-1',
  './modules/city-backdrop.js?v=20260908-1',
  './modules/water-observation.js?v=20260908-1',
  './modules/route-recalculation.js?v=20260911-1',
  './modules/urban-utilities.js?v=20260908-1',
  './modules/shelter-arrival.js?v=20260908-1',
  './modules/mission-state.js?v=20260915-1',
  './scenarios.js?v=20260901-21',
  './manifest.webmanifest',
  './icon.svg',
  './vendor/three.module.js?v=20260901-21'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin === self.location.origin) {
    if (requestUrl.searchParams.has('v')) {
      event.respondWith(
        caches.match(event.request)
          .then((cached) => cached || fetch(event.request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            }
            return response;
          }))
      );
      return;
    }
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(fetch(event.request));
});
