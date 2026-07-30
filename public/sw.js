/* Minimal service worker — required for Android installability */
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Network-first: keep app online-capable without aggressive caching
  event.respondWith(fetch(event.request));
});
