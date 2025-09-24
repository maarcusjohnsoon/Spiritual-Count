// Spiritual Count - Service Worker
// Provides offline functionality and caching for the application

const CACHE_NAME = 'spiritual-count-v1';
const CACHE_VERSION = '1.0.0';

// Assets to cache for offline functionality
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/about.html',
  '/tracker.html',
  '/themes.html',
  '/contact.html',
  '/style.css',
  '/script.js'
];

// Additional assets that might be requested
const OPTIONAL_ASSETS = [
  '/manifest.json',
  '/favicon.ico'
];

// All assets to cache
const ALL_ASSETS = [...CORE_ASSETS, ...OPTIONAL_ASSETS];

/**
 * Service Worker Installation Event
 * Cache all required assets when the service worker is first installed
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker version:', CACHE_VERSION);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching core assets');
        // Cache core assets first (these are critical)
        return cache.addAll(CORE_ASSETS);
      })
      .then(() => {
        console.log('[SW] Core assets cached successfully');
        // Try to cache optional assets, but don't fail if they're not available
        return caches.open(CACHE_NAME);
      })
      .then((cache) => {
        // Attempt to cache optional assets individually
        const optionalPromises = OPTIONAL_ASSETS.map(asset => {
          return fetch(asset)
            .then(response => {
              if (response.ok) {
                return cache.put(asset, response);
              }
            })
            .catch(() => {
              // Silently ignore failures for optional assets
              console.log(`[SW] Optional asset not available: ${asset}`);
            });
        });
        return Promise.all(optionalPromises);
      })
      .then(() => {
        console.log('[SW] Installation complete');
        // Skip waiting and immediately become the active service worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error);
      })
  );
});

/**
 * Service Worker Activation Event
 * Clean up old caches and take control of all clients
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker version:', CACHE_VERSION);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        // Delete old caches
        const deletePromises = cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        });
        return Promise.all(deletePromises);
      })
      .then(() => {
        console.log('[SW] Old caches cleaned up');
        // Take control of all clients immediately
        return self.clients.claim();
      })
      .then(() => {
        console.log('[SW] Service Worker is now controlling all clients');
      })
      .catch((error) => {
        console.error('[SW] Activation failed:', error);
      })
  );
});

/**
 * Fetch Event Handler
 * Implement cache-first strategy for static assets and network-first for API calls
 */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip cross-origin requests (like analytics, fonts from CDNs, etc.)
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // Handle different types of requests with appropriate strategies
  if (isStaticAsset(url.pathname)) {
    // Cache-first strategy for static assets
    event.respondWith(handleStaticAsset(request));
  } else if (isHTMLPage(url.pathname)) {
    // Network-first with cache fallback for HTML pages
    event.respondWith(handleHTMLPage(request));
  } else {
    // Default to network-first for other requests
    event.respondWith(handleNetworkFirst(request));
  }
});

/**
 * Check if the request is for a static asset
 */
function isStaticAsset(pathname) {
  const staticExtensions = ['.css', '.js', '.json', '.ico', '.png', '.jpg', '.jpeg', '.svg', '.woff', '.woff2'];
  return staticExtensions.some(ext => pathname.endsWith(ext));
}

/**
 * Check if the request is for an HTML page
 */
function isHTMLPage(pathname) {
  return pathname.endsWith('.html') || pathname === '/';
}

/**
 * Handle static assets with cache-first strategy
 * These assets rarely change, so we can serve from cache for better performance
 */
async function handleStaticAsset(request) {
  try {
    // Try to get from cache first
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving from cache:', request.url);
      return cachedResponse;
    }
    
    // If not in cache, fetch from network and cache the response
    console.log('[SW] Fetching from network:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Clone the response before caching (responses can only be consumed once)
      const responseToCache = networkResponse.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, responseToCache);
      console.log('[SW] Cached new asset:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Error handling static asset:', error);
    
    // Try to return cached version as fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving stale cache as fallback:', request.url);
      return cachedResponse;
    }
    
    // If nothing is available, return a generic error response
    return new Response('Asset not available offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Handle HTML pages with network-first strategy
 * We want fresh HTML content when online, but cache as fallback for offline
 */
async function handleHTMLPage(request) {
  try {
    // Try network first
    console.log('[SW] Fetching HTML from network:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cache the fresh HTML response
      const responseToCache = networkResponse.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, responseToCache);
      console.log('[SW] Cached fresh HTML:', request.url);
      return networkResponse;
    }
    
    // If network fails, try cache
    throw new Error('Network response not ok');
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    // Fallback to cached version
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving cached HTML:', request.url);
      return cachedResponse;
    }
    
    // If no cached version, try to serve the main index.html as fallback
    const indexFallback = await caches.match('/index.html');
    if (indexFallback) {
      console.log('[SW] Serving index.html as fallback');
      return indexFallback;
    }
    
    // Last resort: return an offline page response
    return new Response(createOfflinePage(), {
      status: 200,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

/**
 * Handle other requests with network-first strategy
 */
async function handleNetworkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok && request.method === 'GET') {
      // Cache successful GET responses
      const responseToCache = networkResponse.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, responseToCache);
    }
    
    return networkResponse;
  } catch (error) {
    // Try to return cached version
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return error response if nothing is available
    return new Response('Request failed and no cached version available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Create a basic offline page when no cached content is available
 */
function createOfflinePage() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Offline - Spiritual Count</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
            }
            .container {
                max-width: 400px;
                background: rgba(255, 255, 255, 0.1);
                padding: 2rem;
                border-radius: 1rem;
                backdrop-filter: blur(10px);
            }
            h1 {
                margin-bottom: 1rem;
                font-size: 2rem;
            }
            p {
                margin-bottom: 1.5rem;
                line-height: 1.6;
            }
            button {
                background: rgba(255, 255, 255, 0.2);
                border: 2px solid white;
                color: white;
                padding: 0.75rem 1.5rem;
                border-radius: 0.5rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            button:hover {
                background: rgba(255, 255, 255, 0.3);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📱 Spiritual Count</h1>
            <p>You're currently offline, but don't worry! Once you're back online, you can access all features of Spiritual Count.</p>
            <p>Your dhikr counts and settings are safely stored on your device.</p>
            <button onclick="window.location.reload()">Try Again</button>
        </div>
        <script>
            // Auto-reload when back online
            window.addEventListener('online', () => {
                window.location.reload();
            });
        </script>
    </body>
    </html>
  `;
}

/**
 * Handle service worker messages from the main thread
 */
self.addEventListener('message', (event) => {
  console.log('[SW] Received message:', event.data);
  
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'GET_VERSION':
        event.ports[0].postMessage({
          type: 'VERSION',
          version: CACHE_VERSION
        });
        break;
      
      case 'SKIP_WAITING':
        self.skipWaiting();
        event.ports[0].postMessage({
          type: 'SKIPPED_WAITING'
        });
        break;
      
      case 'CACHE_STATUS':
        caches.has(CACHE_NAME).then((hasCache) => {
          event.ports[0].postMessage({
            type: 'CACHE_STATUS',
            hasCache,
            cacheName: CACHE_NAME
          });
        });
        break;
      
      default:
        console.log('[SW] Unknown message type:', event.data.type);
    }
  }
});

/**
 * Handle service worker errors
 */
self.addEventListener('error', (error) => {
  console.error('[SW] Service Worker error:', error);
});

/**
 * Handle unhandled promise rejections
 */
self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW] Unhandled promise rejection:', event.reason);
  // Prevent the default behavior (logging to console)
  event.preventDefault();
});

console.log('[SW] Service Worker script loaded successfully');
