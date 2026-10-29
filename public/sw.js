// HappyHomesHub service worker — Web Push + lightweight offline shell.
// Bumped CACHE version invalidates old caches on activate.
const CACHE = 'hhh-shell-v1';
const SHELL = ['/'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

// Network-first for navigations so the SPA always gets fresh HTML when online,
// falling back to the cached shell offline. Other requests pass through.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/').then((r) => r || Response.error())),
    );
  }
});

// Web Push: show the notification sent by the send-push function.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = {}; }
  const title = data.title || 'HappyHomesHub';
  const options = {
    body: data.body || '',
    icon: '/hhh-icon.svg',
    badge: '/hhh-icon.svg',
    data: { url: data.url || '/' },
    tag: data.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Focus an existing tab or open the target URL on click.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) { client.navigate(url); return client.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});
