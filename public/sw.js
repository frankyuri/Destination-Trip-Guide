const VERSION = 'destination-trip-v2';
const APP_CACHE = `${VERSION}-app`;
const TILE_CACHE = `${VERSION}-tiles`;
const MAX_TILE_ENTRIES = 180;
const BASE_PATH = new URL(self.registration.scope).pathname;
const APP_SHELL = [BASE_PATH, `${BASE_PATH}index.html`, `${BASE_PATH}manifest.json`];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => ![APP_CACHE, TILE_CACHE].includes(name)).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

const trimTileCache = async () => {
  const cache = await caches.open(TILE_CACHE);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_TILE_ENTRIES)).map((key) => cache.delete(key)));
};

const networkFirst = async (request) => {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match(`${BASE_PATH}index.html`)) || new Response('離線中', { status: 503 });
  }
};

const cacheFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    if (cacheName === TILE_CACHE) await trimTileCache();
  }
  return response;
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin && url.pathname.startsWith(`${BASE_PATH}api/`)) return;

  const isMapTile = ['basemaps.cartocdn.com', 'server.arcgisonline.com', 'tile.opentopomap.org'].some((host) => url.hostname.endsWith(host));
  if (isMapTile) {
    event.respondWith(cacheFirst(request, TILE_CACHE).catch(() => new Response('', { status: 504 })));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith(BASE_PATH)) {
    event.respondWith(cacheFirst(request, APP_CACHE));
  }
});