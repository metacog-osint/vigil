// Vigil Service Worker - Offline Support
const CACHE_NAME = 'vigil-cache-v1'
const STATIC_CACHE = 'vigil-static-v1'
const DATA_CACHE = 'vigil-data-v1'

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
]

// API endpoints to cache with network-first strategy
const CACHEABLE_API_PATTERNS = [
  /\/rest\/v1\/threat_actors/,
  /\/rest\/v1\/incidents/,
  /\/rest\/v1\/vulnerabilities/,
  /\/rest\/v1\/iocs/,
  /\/rest\/v1\/attack_techniques/,
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets')
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('vigil-') &&
                   name !== CACHE_NAME &&
                   name !== STATIC_CACHE &&
                   name !== DATA_CACHE
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name)
            return caches.delete(name)
          })
      )
    })
  )
  self.clients.claim()
})

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return

  // Handle API requests with network-first strategy
  if (isCacheableApi(url)) {
    event.respondWith(networkFirstWithCache(request, DATA_CACHE))
    return
  }

  // Handle static assets with cache-first strategy
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE))
    return
  }

  // Handle navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // Default: try network, fall back to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone and cache successful responses
        if (response.ok) {
          const responseClone = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone)
          })
        }
        return response
      })
      .catch(() => caches.match(request))
  )
})

// Network-first strategy with cache fallback
async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request)

    // Only cache complete responses (not partial 206 responses)
    if (response.ok && response.status !== 206) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }

    return response
  } catch (error) {
    const cached = await caches.match(request)
    if (cached) {
      console.log('[SW] Serving from cache (offline):', request.url)
      return cached
    }

    // Return offline response for API requests
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'You are offline. Data may be stale.',
        cached: false
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// Cache-first strategy with network fallback
async function cacheFirstWithNetwork(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) {
    return cached
  }

  try {
    const response = await fetch(request)

    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }

    return response
  } catch (error) {
    console.log('[SW] Failed to fetch:', request.url)
    return new Response('Offline', { status: 503 })
  }
}

// Check if URL is a cacheable API endpoint
function isCacheableApi(url) {
  return CACHEABLE_API_PATTERNS.some((pattern) => pattern.test(url.pathname))
}

// Check if URL is a static asset
function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2']
  return staticExtensions.some((ext) => url.pathname.endsWith(ext))
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting()
  }

  if (event.data === 'clearCache') {
    caches.keys().then((names) => {
      names.forEach((name) => {
        if (name.startsWith('vigil-')) {
          caches.delete(name)
        }
      })
    })
  }
})

// Background sync for offline actions (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-watchlist') {
    console.log('[SW] Background sync: watchlist')
    // Sync watchlist changes when back online
  }
})

// ============================================
// Push Notification Handling
// ============================================

// Handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received')

  let data = {
    title: 'Vigil Alert',
    body: 'New security event detected',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: 'vigil-alert',
    data: { url: '/' }
  }

  // Parse push data if available
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() }
    } catch (e) {
      console.error('[SW] Failed to parse push data:', e)
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/badge-72.png',
    tag: data.tag || 'vigil-alert',
    data: data.data || { url: '/' },
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [
      { action: 'view', title: 'View Details' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    vibrate: [200, 100, 200]
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action)

  event.notification.close()

  if (event.action === 'dismiss') {
    return
  }

  // Get the URL to open
  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus an existing window
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus()
            client.navigate(urlToOpen)
            return
          }
        }

        // Open a new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      })
  )
})

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag)
})

// Handle push subscription change
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed')

  event.waitUntil(
    // Re-subscribe with new subscription
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: self.vapidPublicKey
    })
    .then((subscription) => {
      // Send new subscription to server
      return fetch('/api/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      })
    })
    .catch((error) => {
      console.error('[SW] Failed to resubscribe:', error)
    })
  )
})

console.log('[SW] Service Worker loaded')
