/* Service worker PWA: cache shell aplikasi dan halaman offline. */
const CACHE_PREFIX = 'campus-lost-found-';
const CACHE_NAME = `${CACHE_PREFIX}v6`;
const APP_SHELL = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(
        APP_SHELL.map((url) => cache.add(new Request(url, { cache: 'reload' })))
      );

      // Simpan aset build halaman awal agar shell tetap utuh saat offline
      // meskipun cache HTTP browser sudah dibersihkan.
      try {
        const response = await cache.match('/');
        if (response) {
          const html = await response.text();
          const assets = new Set(
            [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map(
              (match) => match[1]
            )
          );
          await Promise.allSettled(
            [...assets].map((url) => cache.add(new Request(url, { cache: 'reload' })))
          );
        }
      } catch {
        // Halaman tetap bisa dipakai; aset akan di-cache saat kunjungan berikutnya.
      }

      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    return (await cache.match('/offline.html')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

/* Fungsi simpan notifikasi push ke IndexedDB agar bisa dibaca panel web saat dibuka */
function saveNotificationToIndexedDB(notif) {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('campus_lost_found_db', 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('notifications')) {
          db.createObjectStore('notifications', { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('notifications', 'readwrite');
        tx.objectStore('notifications').put(notif);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      request.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/* Event Push Notification */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const now = new Date();
  const title = data.title || 'Campus Lost & Found';
  const notifItem = {
    id: data.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title,
    body: data.body || 'Ada pembaruan status laporan barang.',
    url: data.url || '/',
    createdAt: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    createdAtIso: now.toISOString(),
    isRead: false,
    type: data.type || 'CLAIM_DECIDED',
  };

  const options = {
    body: notifItem.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || notifItem.id,
    vibrate: [200, 100, 200],
    renotify: true,
    data: { url: notifItem.url },
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      saveNotificationToIndexedDB(notifItem),
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({
            type: 'PUSH_NOTIFICATION_RECEIVED',
            notification: notifItem,
          });
        }
      }),
    ])
  );
});

/* Event Klik Notifikasi: bawa pengguna ke halaman terkait */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url || '/';
  let targetUrl = new URL('/', self.location.origin);

  try {
    if (typeof rawUrl === 'string' && !rawUrl.includes('\\')) {
      const candidate = new URL(rawUrl, self.location.origin);
      if (candidate.origin === self.location.origin) {
        targetUrl = candidate;
      }
    }
  } catch {
    targetUrl = new URL('/', self.location.origin);
  }

  const targetRelative = `${targetUrl.pathname}${targetUrl.search}`;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList) => {
      for (const client of clientList) {
        try {
          const clientParsed = new URL(client.url);
          if (
            clientParsed.origin === self.location.origin &&
            `${clientParsed.pathname}${clientParsed.search}` === targetRelative &&
            'focus' in client
          ) {
            return client.focus();
          }
        } catch {
          // Lewati client URL tidak valid
        }
      }

      for (const client of clientList) {
        try {
          const clientParsed = new URL(client.url);
          if (clientParsed.origin === self.location.origin && 'focus' in client) {
            await client.focus();
            if ('navigate' in client) {
              return client.navigate(targetUrl.href);
            }
            return client;
          }
        } catch {
          // Lewati
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl.href);
      }
    })
  );
});
