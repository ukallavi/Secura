// frontend/lib/api-config.js
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/auth/login`,
  REGISTER: `${API_BASE_URL}/auth/register`,
  LOGOUT: `${API_BASE_URL}/auth/logout`,
  AUTH_SALT: `${API_BASE_URL}/auth/salt`,
  PROFILE: `${API_BASE_URL}/users/profile`,
  PROFILE_PASSWORD: `${API_BASE_URL}/users/password`,
  PASSWORDS: `${API_BASE_URL}/passwords`,
  GENERATE_PASSWORD: `${API_BASE_URL}/passwords/generate`,
  TWO_FACTOR: `${API_BASE_URL}/auth/2fa`,
  TWO_FACTOR_VERIFY: `${API_BASE_URL}/auth/2fa/verify`,
  TWO_FACTOR_SETUP: `${API_BASE_URL}/auth/2fa/setup`,
  TWO_FACTOR_DISABLE: `${API_BASE_URL}/auth/2fa/disable`,
  TWO_FACTOR_BACKUP_CODES: `${API_BASE_URL}/auth/2fa/backup-codes`,
  TWO_FACTOR_EMAIL_RECOVERY: `${API_BASE_URL}/auth/2fa/email-recovery`,
  ADMIN_USERS: `${API_BASE_URL}/admin/users`,
  ADMIN_STATS: `${API_BASE_URL}/admin/error-tracking/stats`,
  ADMIN_ACTIVITY: `${API_BASE_URL}/admin/activity`,
  ADMIN_ERROR_LOGS: `${API_BASE_URL}/admin/error-tracking`,
  PASSWORD_STRENGTH: `${API_BASE_URL}/passwords/check-strength`,
  BATCH_UPDATE_PASSWORDS: `${API_BASE_URL}/passwords/batch-update`,
  
  // Security endpoints
  SECURITY_SCORE: `${API_BASE_URL}/security/score`,
  SECURITY_SETTINGS: `${API_BASE_URL}/security/settings`,
  SECURITY_ACTIVITY: `${API_BASE_URL}/security/activity`,
  SECURITY_RECOMMENDATIONS: `${API_BASE_URL}/security/recommendations`,

  // User endpoints for ATP
  SEND_VERIFICATION_CODE: `${API_BASE_URL}/auth/verification/send-code`,
  COMPLETE_VERIFICATION: `${API_BASE_URL}/auth/verification/complete`,
  
  // Admin endpoints for ATP
  SUSPICIOUS_ACTIVITIES: `${API_BASE_URL}/admin/suspicious-activities`,
  REVIEW_ACTIVITY: (id) => `${API_BASE_URL}/admin/suspicious-activities/${id}/review`,
  USER_ACTIVITIES: (id) => `${API_BASE_URL}/admin/users/${id}/activities`,
  SET_USER_MONITORING: (id) => `${API_BASE_URL}/admin/users/${id}/monitoring`,

  // Admin error tracking endpoints
  ADMIN_ERROR_STATS: `${API_BASE_URL}/admin/error-tracking/stats`,
  ADMIN_ERROR_DETAILS: (id) => `${API_BASE_URL}/admin/error-tracking/${id}`,
  ADMIN_ERROR_RESOLVE: (id) => `${API_BASE_URL}/admin/error-tracking/${id}/resolve`,
  ADMIN_ERROR_REOPEN: (id) => `${API_BASE_URL}/admin/error-tracking/${id}/reopen`,
  ADMIN_ERROR_DELETE: (id) => `${API_BASE_URL}/admin/error-tracking/${id}`,
};

// Error types for better error handling
export const ErrorTypes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
  FORBIDDEN_ERROR: 'FORBIDDEN_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
};

// This export is deprecated - use the implementation in error-handler.js instead
// Kept here for backward compatibility
export const fetchWithCSRF = async (url, options = {}) => {
  console.warn('fetchWithCSRF from api-config.js is deprecated. Use the implementation from error-handler.js instead.');
  
  try {
    // First get CSRF token if needed
    // Use the API_BASE_URL constant to ensure consistency
    const csrfResponse = await fetch(`${API_BASE_URL}/csrf-token`, {
      credentials: 'include',
    });
    
    if (!csrfResponse.ok) {
      throw { 
        type: ErrorTypes.AUTH_ERROR,
        status: csrfResponse.status,
        message: 'Failed to get CSRF token'
      };
    }
    
    const csrfData = await csrfResponse.json();
    const csrfToken = csrfData.token || csrfData.csrfToken;
    
    // Add CSRF token and other default headers
    const headers = {
      'X-CSRF-Token': csrfToken,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    
    // Make the actual request
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });
    
    const responseData = await response.json();
    
    // Check for verification requirement
    if (response.status === 403 && responseData.requiresVerification) {
      // Store verification requirements in session storage
      if (responseData.verificationRequirements) {
        sessionStorage.setItem('verificationRequirements', JSON.stringify(responseData.verificationRequirements));
      }
      
      throw { 
        type: ErrorTypes.VERIFICATION_REQUIRED,
        status: response.status,
        message: responseData.message || 'Verification required',
        verificationRequirements: responseData.verificationRequirements
      };
    }
    
    // Handle other error responses
    if (!response.ok) {
      const errorType = response.status === 401 ? ErrorTypes.AUTH_ERROR :
                         response.status === 400 ? ErrorTypes.VALIDATION_ERROR :
                         response.status === 403 ? ErrorTypes.FORBIDDEN_ERROR :
                         response.status === 404 ? ErrorTypes.NOT_FOUND_ERROR :
                         response.status === 429 ? ErrorTypes.RATE_LIMIT_ERROR :
                         response.status >= 500 ? ErrorTypes.SERVER_ERROR :
                         ErrorTypes.UNKNOWN_ERROR;
      
      throw {
        type: errorType,
        status: response.status,
        message: responseData.message || 'An error occurred'
      };
    }
    
    return responseData;
  } catch (error) {
    // If it's already one of our error types, just rethrow it
    if (error.type) {
      throw error;
    }
    
    // Otherwise, wrap in a network error
    console.error('Fetch error:', error);
    throw {
      type: ErrorTypes.NETWORK_ERROR,
      message: 'Network error, please check your connection'
    };
  }
};