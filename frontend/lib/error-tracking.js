// frontend/lib/error-tracking.js
import { ErrorTypes } from './error-handler';

/**
 * Error tracking and analytics for Secura
 * 
 * This module provides error tracking functionality to collect anonymous data
 * on errors occurring in the application. It can be configured to send data
 * to various analytics services or internal endpoints.
 */

// Configuration for error tracking
const config = {
  // Whether error tracking is enabled - set to false to disable API calls
  enabled: false, // Disabled by default to prevent API call failures
  
  // Endpoint for reporting errors
  endpoint: process.env.NEXT_PUBLIC_ERROR_TRACKING_ENDPOINT || '/api/error-tracking',
  
  // Whether to include user context (anonymized)
  includeUserContext: true,
  
  // Sampling rate (0-1) to reduce volume of error reports
  samplingRate: parseFloat(process.env.NEXT_PUBLIC_ERROR_TRACKING_SAMPLING_RATE || '1.0'),
  
  // Maximum number of errors to track per session
  maxErrorsPerSession: parseInt(process.env.NEXT_PUBLIC_ERROR_TRACKING_MAX_ERRORS || '50', 10),
  
  // Error types to ignore
  ignoredTypes: ['NETWORK_ERROR'],
  
  // Error status codes to ignore
  ignoredStatusCodes: [404],
};

// Error tracking state
const state = {
  errorsTracked: 0,
  sessionId: null,
};

/**
 * Initialize error tracking
 */
export function initErrorTracking() {
  if (!config.enabled) return;
  
  // Generate a session ID
  state.sessionId = generateSessionId();
  state.errorsTracked = 0;
  
  // Set up global error handlers
  setupGlobalHandlers();
  
  console.log('Error tracking initialized');
}

/**
 * Track an error
 * @param {Object} error - Error object
 * @param {Object} context - Additional context
 */
export function trackError(error, context = {}) {
  if (!shouldTrackError(error)) return;
  
  try {
    // Increment error count
    state.errorsTracked++;
    
    // Prepare error data
    const errorData = prepareErrorData(error, context);
    
    // Send error data
    sendErrorData(errorData);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('Error tracked:');
      console.error(error);
      console.log('Context:', context);
      console.log('Tracking data:', errorData);
      console.groupEnd();
    }
  } catch (e) {
    // Don't let tracking errors cause more problems
    console.error('Error in trackError:', e);
  }
}

/**
 * Determine if an error should be tracked
 * @param {Object} error - Error object
 * @returns {boolean}
 */
function shouldTrackError(error) {
  if (!config.enabled) return false;
  if (state.errorsTracked >= config.maxErrorsPerSession) return false;
  if (Math.random() > config.samplingRate) return false;
  
  // Check ignored error types
  if (error.type && config.ignoredTypes.includes(error.type)) return false;
  
  // Check ignored status codes
  if (error.status && config.ignoredStatusCodes.includes(error.status)) return false;
  
  return true;
}

/**
 * Prepare error data for tracking
 * @param {Object} error - Error object
 * @param {Object} context - Additional context
 * @returns {Object} Prepared error data
 */
function prepareErrorData(error, context) {
  // Basic error data
  const errorData = {
    timestamp: new Date().toISOString(),
    sessionId: state.sessionId,
    url: window.location.href,
    userAgent: navigator.userAgent,
    errorCount: state.errorsTracked,
    
    // Error details
    error: {
      type: error.type || ErrorTypes.UNKNOWN_ERROR,
      message: error.message || 'Unknown error',
      status: error.status,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    },
    
    // Context
    context: {
      ...context,
      component: context.component,
      action: context.action,
    },
  };
  
  // Add user context if enabled
  if (config.includeUserContext) {
    try {
      // Get user ID from localStorage or sessionStorage
      const userId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
      
      // Only include anonymized user data
      if (userId) {
        errorData.user = {
          // Hash the user ID for privacy
          id: hashUserId(userId),
          // Include role if available
          role: getUserRole(),
        };
      }
    } catch (e) {
      // Ignore errors accessing storage
    }
  }
  
  return errorData;
}

/**
 * Send error data to tracking endpoint
 * @param {Object} errorData - Prepared error data
 */
function sendErrorData(errorData) {
  // Always log locally, regardless of config.enabled setting
  
  // Log to console for development/debugging
  console.warn('Error tracked:', {
    type: errorData.error?.type || 'Unknown',
    message: errorData.error?.message || 'Unknown error',
    url: errorData.url,
    timestamp: errorData.timestamp
  });
  
  // Don't make any API calls
  
  // For development, store minimal error info in localStorage
  if (process.env.NODE_ENV === 'development') {
    try {
      const storedErrors = JSON.parse(localStorage.getItem('secura_errors') || '[]');
      storedErrors.push({
        type: errorData.error?.type || 'Unknown',
        message: errorData.error?.message || 'Unknown error',
        url: errorData.url,
        timestamp: errorData.timestamp
      });
      // Only keep the most recent errors to avoid storage issues
      localStorage.setItem('secura_errors', JSON.stringify(storedErrors.slice(-10)));
    } catch (e) {
      // Ignore storage errors
    }
  }
}

/**
 * Set up global error handlers
 */
function setupGlobalHandlers() {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    trackError(event.reason || new Error('Unhandled Promise rejection'), {
      source: 'unhandledrejection',
    });
  });
  
  // Handle uncaught exceptions
  window.addEventListener('error', (event) => {
    trackError(event.error || new Error(event.message), {
      source: 'window.onerror',
      fileName: event.filename,
      lineNumber: event.lineno,
      columnNumber: event.colno,
    });
  });
}

/**
 * Generate a session ID
 * @returns {string} Session ID
 */
function generateSessionId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Hash a user ID for privacy
 * @param {string} userId - User ID
 * @returns {string} Hashed user ID
 */
function hashUserId(userId) {
  // Simple hash function for demo purposes
  // In production, use a proper hashing algorithm
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'user_' + Math.abs(hash).toString(36);
}

/**
 * Get the current user's role
 * @returns {string|undefined} User role
 */
function getUserRole() {
  try {
    // Get user data from storage
    const userData = JSON.parse(localStorage.getItem('user_data') || sessionStorage.getItem('user_data') || '{}');
    return userData.role;
  } catch (e) {
    return undefined;
  }
}
