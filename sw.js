const CACHE_NAME = 'barberflow-v1';

// O que salvar no cache para abrir mais rápido
const urlsToCache = [
  './',
  './index.html',
  './login.html',
  './mobile.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Faz o site funcionar mais rápido buscando do cache primeiro
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Retorna do cache
        }
        return fetch(event.request); // Retorna da internet
      })
  );
});