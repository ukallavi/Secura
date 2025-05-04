// frontend/lib/offline-handler.js
import { ErrorTypes } from './error-handler';
import { getErrorMessage } from './i18n/error-messages';

/**
 * Offline handling and detection for Secura
 * 
 * This module provides functionality to detect offline status,
 * handle offline errors, and implement retry mechanisms.
 */

// Configuration
const config = {
  // Maximum number of retry attempts
  maxRetries: 3,
  
  // Base delay for exponential backoff (in ms)
  baseRetryDelay: 1000,
  
  // Maximum delay for retries (in ms)
  maxRetryDelay: 30000,
  
  // Whether to automatically retry on network errors
  autoRetry: true,
  
  // Critical API endpoints that should be cached for offline use
  criticalEndpoints: [
    '/api/passwords',
    '/api/users/profile',
  ],
};

// State
let isOffline = !navigator.onLine;
let offlineListeners = [];

/**
 * Initialize offline handling
 */
function initOfflineHandling() {
  // Set up online/offline event listeners
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Set up service worker for offline caching if supported
  if ('serviceWorker' in navigator) {
    setupServiceWorker();
  }
  
  console.log(`Offline handling initialized. Current status: ${isOffline ? 'offline' : 'online'}`);
}

/**
 * Handle going online
 */
function handleOnline() {
  isOffline = false;
  console.log('Connection restored. Back online.');
  
  // Notify listeners
  offlineListeners.forEach(listener => {
    try {
      listener(false);
    } catch (e) {
      console.error('Error in offline listener:', e);
    }
  });
  
  // Process pending requests
  processPendingRequests();
}

/**
 * Handle going offline
 */
function handleOffline() {
  isOffline = true;
  console.log('Connection lost. Now offline.');
  
  // Notify listeners
  offlineListeners.forEach(listener => {
    try {
      listener(true);
    } catch (e) {
      console.error('Error in offline listener:', e);
    }
  });
}

/**
 * Subscribe to offline status changes
 * @param {Function} listener - Callback function(isOffline)
 * @returns {Function} Unsubscribe function
 */
function subscribeToOfflineStatus(listener) {
  offlineListeners.push(listener);
  
  // Immediately call with current status
  try {
    listener(isOffline);
  } catch (e) {
    console.error('Error in offline listener:', e);
  }
  
  // Return unsubscribe function
  return () => {
    offlineListeners = offlineListeners.filter(l => l !== listener);
  };
}

/**
 * Check if the application is currently offline
 * @returns {boolean} True if offline
 */
function checkIfOffline() {
  return isOffline;
}

/**
 * Perform a fetch with offline handling and retry capability
 * @param {string|Request} resource - Resource to fetch
 * @param {Object} options - Fetch options
 * @param {Object} retryOptions - Retry options
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithOfflineHandling(resource, options = {}, retryOptions = {}) {
  const {
    maxRetries = config.maxRetries,
    baseDelay = config.baseRetryDelay,
    maxDelay = config.maxRetryDelay,
    retryOnStatus = [408, 429, 500, 502, 503, 504],
    fallbackToCache = true,
  } = retryOptions;
  
  let retries = 0;
  
  // Function to perform the fetch with retry logic
  const attemptFetch = async () => {
    try {
      // Check if offline before attempting fetch
      if (isOffline) {
        // If offline and fallback to cache is enabled, try to get from cache
        if (fallbackToCache) {
          const cachedResponse = await getCachedResponse(resource);
          if (cachedResponse) {
            return cachedResponse;
          }
        }
        
        // If we can't get from cache, queue the request for later
        if (shouldQueueRequest(resource, options)) {
          queueRequest(resource, options);
        }
        
        // Throw offline error
        throw {
          type: ErrorTypes.NETWORK_ERROR,
          message: getErrorMessage('network.offline'),
          offline: true,
        };
      }
      
      // Attempt the fetch
      const response = await fetch(resource, options);
      
      // Check if we should retry based on status code
      if (!response.ok && retryOnStatus.includes(response.status) && retries < maxRetries) {
        retries++;
        
        // Calculate delay with exponential backoff and jitter
        const delay = Math.min(
          Math.random() * (baseDelay * Math.pow(2, retries)),
          maxDelay
        );
        
        console.log(`Retrying fetch (${retries}/${maxRetries}) after ${delay}ms due to status ${response.status}`);
        
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, delay));
        return attemptFetch();
      }
      
      // Cache successful GET responses for critical endpoints
      if (response.ok && options.method === 'GET' && isCriticalEndpoint(resource)) {
        cacheResponse(resource, response.clone());
      }
      
      return response;
    } catch (error) {
      // Handle network errors with retry logic
      if (error.offline !== true && retries < maxRetries && config.autoRetry) {
        retries++;
        
        // Calculate delay with exponential backoff and jitter
        const delay = Math.min(
          Math.random() * (baseDelay * Math.pow(2, retries)),
          maxDelay
        );
        
        console.log(`Retrying fetch (${retries}/${maxRetries}) after ${delay}ms due to error:`, error);
        
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, delay));
        return attemptFetch();
      }
      
      // If it's not an offline error already, convert to proper error format
      if (error.offline !== true) {
        throw {
          type: ErrorTypes.NETWORK_ERROR,
          message: getErrorMessage('network.timeout'),
          originalError: error,
        };
      }
      
      throw error;
    }
  };
  
  return attemptFetch();
}

/**
 * Check if an endpoint is critical and should be cached
 * @param {string|Request} resource - Resource to check
 * @returns {boolean} True if critical
 */
function isCriticalEndpoint(resource) {
  const url = typeof resource === 'string' ? resource : resource.url;
  return config.criticalEndpoints.some(endpoint => url.includes(endpoint));
}

/**
 * Get a cached response
 * @param {string|Request} resource - Resource to get from cache
 * @returns {Promise<Response|null>} Cached response or null
 */
async function getCachedResponse(resource) {
  if (!('caches' in window)) return null;
  
  try {
    const cache = await caches.open('secura-offline');
    const cachedResponse = await cache.match(resource);
    
    if (cachedResponse) {
      // Add a header to indicate this is from cache
      const headers = new Headers(cachedResponse.headers);
      headers.append('X-Secura-From-Cache', 'true');
      
      // Create a new response with the modified headers
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText + ' (Offline)',
        headers,
      });
    }
    
    return null;
  } catch (e) {
    console.error('Error getting cached response:', e);
    return null;
  }
}

/**
 * Cache a response for offline use
 * @param {string|Request} resource - Resource to cache
 * @param {Response} response - Response to cache
 */
async function cacheResponse(resource, response) {
  if (!('caches' in window)) return;
  
  try {
    const cache = await caches.open('secura-offline');
    await cache.put(resource, response);
  } catch (e) {
    console.error('Error caching response:', e);
  }
}

/**
 * Check if a request should be queued for later
 * @param {string|Request} resource - Resource to check
 * @param {Object} options - Fetch options
 * @returns {boolean} True if should queue
 */
function shouldQueueRequest(resource, options) {
  // Only queue mutating requests (POST, PUT, DELETE)
  const method = options.method || 'GET';
  return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
}

/**
 * Queue a request for when we're back online
 * @param {string|Request} resource - Resource to queue
 * @param {Object} options - Fetch options
 */
function queueRequest(resource, options) {
  try {
    // Get existing queue from storage
    const queue = JSON.parse(localStorage.getItem('offline_request_queue') || '[]');
    
    // Add request to queue
    queue.push({
      resource: typeof resource === 'string' ? resource : resource.url,
      options: {
        ...options,
        // Don't store request body directly, as it might be a FormData or other non-serializable object
        body: options.body ? '[BODY]' : undefined,
      },
      timestamp: Date.now(),
    });
    
    // Save queue back to storage
    localStorage.setItem('offline_request_queue', JSON.stringify(queue));
    
    console.log('Request queued for when back online:', resource);
  } catch (e) {
    console.error('Error queuing request:', e);
  }
}

/**
 * Process pending requests when back online
 */
function processPendingRequests() {
  try {
    // Get queue from storage
    const queue = JSON.parse(localStorage.getItem('offline_request_queue') || '[]');
    
    if (queue.length === 0) return;
    
    console.log(`Processing ${queue.length} pending requests`);
    
    // Clear queue
    localStorage.setItem('offline_request_queue', '[]');
    
    // Process each request
    queue.forEach(item => {
      // We can't restore the original body, so we need to notify the user
      console.log('Pending request needs to be retried manually:', item);
      
      // In a real app, we might show a notification to the user
      // that they need to retry their action
    });
  } catch (e) {
    console.error('Error processing pending requests:', e);
  }
}

/**
 * Set up service worker for offline support
 */
async function setupServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    console.log('Service worker registered:', registration);
  } catch (e) {
    console.error('Error registering service worker:', e);
  }
}

// Export functions
export {
  initOfflineHandling,
  subscribeToOfflineStatus,
  checkIfOffline,
  checkIfOffline as isOffline, // Alias for backward compatibility
  fetchWithOfflineHandling,
  setupServiceWorker
};
