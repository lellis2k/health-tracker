// Health Tracker Service Worker
// Minimal SW for PWA installability — offline support can be added later

const CACHE_NAME = 'health-tracker-v1'

// Install: cache only the bare minimum for the shell
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/'])
    })
  )
})

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

// Fetch: network-first strategy (app always needs auth / fresh data)
// Structure is here so offline caching can be added per-route later
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response
      })
      .catch(() => {
        // Offline fallback — return cached root if available
        return caches.match('/') || new Response('Offline', { status: 503 })
      })
  )
})
