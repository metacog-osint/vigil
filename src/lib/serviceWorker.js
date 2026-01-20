// Service Worker Registration and Management

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })

    console.log('[SW] Service worker registered:', registration.scope)

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      console.log('[SW] New service worker installing...')

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available
          console.log('[SW] New version available')
          dispatchUpdateEvent()
        }
      })
    })

    // Check for updates periodically (every hour)
    setInterval(
      () => {
        registration.update()
      },
      60 * 60 * 1000
    )

    return registration
  } catch (error) {
    console.error('[SW] Registration failed:', error)
    return null
  }
}

export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.unregister()
      console.log('[SW] Service worker unregistered')
    })
  }
}

export function clearServiceWorkerCache() {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage('clearCache')
    console.log('[SW] Cache clear requested')
  }
}

export function skipWaitingServiceWorker() {
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage('skipWaiting')
  }
}

// Dispatch custom event when update is available
function dispatchUpdateEvent() {
  window.dispatchEvent(
    new CustomEvent('swUpdate', {
      detail: { updateAvailable: true },
    })
  )
}

// Check if we're running offline
export function isOffline() {
  return !navigator.onLine
}

// Listen for online/offline changes
export function onOnlineStatusChange(callback) {
  window.addEventListener('online', () => callback(true))
  window.addEventListener('offline', () => callback(false))

  return () => {
    window.removeEventListener('online', () => callback(true))
    window.removeEventListener('offline', () => callback(false))
  }
}

// Get cache statistics
export async function getCacheStats() {
  if (!('caches' in window)) return null

  const cacheNames = await caches.keys()
  const vigilCaches = cacheNames.filter((name) => name.startsWith('vigil-'))

  const stats = await Promise.all(
    vigilCaches.map(async (name) => {
      const cache = await caches.open(name)
      const keys = await cache.keys()
      return { name, count: keys.length }
    })
  )

  return stats
}
