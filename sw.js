const CACHE_NAME = 'ltech-shell-v1';
const APP_SHELL = [
    '/home.html',
    '/blogs.html',
    '/gallery.html',
    '/manifest.json',
    '/src/styles/style.css',
    '/src/assets/logo.png',
    '/src/assets/dp.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    if (requestUrl.pathname.startsWith('/api/') || requestUrl.pathname.startsWith('/src/assets/project-')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => cachedResponse || fetch(event.request).then((networkResponse) => {
            if (event.request.method === 'GET' && networkResponse.ok && requestUrl.origin === self.location.origin) {
                const responseCopy = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
            }
            return networkResponse;
        }))
    );
});
