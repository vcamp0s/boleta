/* Service Worker — cache offline básico (app shell) */
const CACHE = 'boleta-v30';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/utils.js',
  './js/store.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/company.png',
  './icons/icon-192-2.png',
  './icons/icon-512-2.png'
];

self.addEventListener('install', e => {
  // {cache:'reload'} força buscar do servidor (ignora o cache HTTP do navegador) ao pré-cachear
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// network-first com revalidação: com internet sempre confere a versão nova no servidor
// ({cache:'no-cache'} evita o cache HTTP do navegador servir arquivo velho); cache é reserva offline
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
  );
});
