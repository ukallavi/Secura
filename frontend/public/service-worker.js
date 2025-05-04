// frontend/public/service-worker.js
/**
 * Service Worker for Secura Password Manager
 * Provides offline support and caching for critical resources
 */

// Cache name and version
const CACHE_NAME = 'secura-cache-v1';

// Resources to cache immediately on install
const PRECACHE_RESOURCES = [
  '/',
  '/login',
  '/offline',
  '/favicon.ico',
  '/logo.png',
  '/manifest.json',
  '/css/main.css',
  '/js/main.js',
];

// Critical API endpoints to cache on network response
const API_CACHE_URLS = [
  '/api/users/profile',
  '/api/passwords/stats',
];

// Install event - precache critical resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Precaching resources');
        return cache.addAll(PRECACHE_RESOURCES);
      })
      .then(() => {
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients
      return self.clients.claim();
    })
  );
});

// Fetch event - network-first strategy with fallback to cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // For API requests, use network-first strategy
  if (isApiRequest(event.request)) {
    event.respondWith(networkFirstStrategy(event.request));
    return;
  }
  
  // For static assets, use cache-first strategy
  if (isStaticAsset(event.request)) {
    event.respondWith(cacheFirstStrategy(event.request));
    return;
  }
  
  // For HTML pages, use network-first strategy
  if (isHtmlRequest(event.request)) {
    event.respondWith(networkFirstWithOfflineFallback(event.request));
    return;
  }
  
  // Default to network-first
  event.respondWith(networkFirstStrategy(event.request));
});

/**
 * Network-first strategy: try network, fall back to cache
 * @param {Request} request - The request to fetch
 * @returns {Promise<Response>} The response
 */
async function networkFirstStrategy(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // If successful, clone and cache the response
    if (networkResponse.ok && shouldCacheResponse(request)) {
      const responseToCache = networkResponse.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, responseToCache);
      });
    }
    
    return networkResponse;
  } catch (error) {
    // If network fails, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If no cache, throw error
    throw error;
  }
}

/**
 * Cache-first strategy: try cache, fall back to network
 * @param {Request} request - The request to fetch
 * @returns {Promise<Response>} The response
 */
async function cacheFirstStrategy(request) {
  // Try cache first
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // If not in cache, get from network
  try {
    const networkResponse = await fetch(request);
    
    // Cache the response for future
    if (networkResponse.ok) {
      const responseToCache = networkResponse.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, responseToCache);
      });
    }
    
    return networkResponse;
  } catch (error) {
    // If both cache and network fail, return error
    throw error;
  }
}

/**
 * Network-first with offline fallback for HTML pages
 * @param {Request} request - The request to fetch
 * @returns {Promise<Response>} The response
 */
async function networkFirstWithOfflineFallback(request) {
  try {
    // Try network first
    return await fetch(request);
  } catch (error) {
    // If network fails, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If no cache, return offline page
    return caches.match('/offline');
  }
}

/**
 * Check if a request is for an API endpoint
 * @param {Request} request - The request to check
 * @returns {boolean} True if it's an API request
 */
function isApiRequest(request) {
  return request.url.includes('/api/');
}

/**
 * Check if a request is for a static asset
 * @param {Request} request - The request to check
 * @returns {boolean} True if it's a static asset
 */
function isStaticAsset(request) {
  const url = new URL(request.url);
  return (
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg')
  );
}

/**
 * Check if a request is for an HTML page
 * @param {Request} request - The request to check
 * @returns {boolean} True if it's an HTML request
 */
function isHtmlRequest(request) {
  const url = new URL(request.url);
  const isGetRequest = request.method === 'GET';
  const isHTMLAccepted = request.headers.get('accept')?.includes('text/html');
  const hasNoExtension = !url.pathname.includes('.');
  
  return isGetRequest && (isHTMLAccepted || hasNoExtension);
}

/**
 * Check if a response should be cached
 * @param {Request} request - The request to check
 * @returns {boolean} True if the response should be cached
 */
function shouldCacheResponse(request) {
  // Only cache GET requests
  if (request.method !== 'GET') {
    return false;
  }
  
  // Cache API responses selectively
  if (isApiRequest(request)) {
    return API_CACHE_URLS.some(url => request.url.includes(url));
  }
  
  // Cache static assets and HTML pages
  return isStaticAsset(request) || isHtmlRequest(request);
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
