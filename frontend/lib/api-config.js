// frontend/lib/api-config.js
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/auth/login`,
  REGISTER: `${API_BASE_URL}/auth/register`,
  LOGOUT: `${API_BASE_URL}/auth/logout`,
  PROFILE: `${API_BASE_URL}/users/profile`,
  PASSWORDS: `${API_BASE_URL}/passwords`,
  GENERATE_PASSWORD: `${API_BASE_URL}/passwords/generate`,
  TWO_FACTOR: `${API_BASE_URL}/auth/2fa`,
  VERIFY_TWO_FACTOR: `${API_BASE_URL}/auth/verify-2fa`,
  ADMIN_USERS: `${API_BASE_URL}/admin/users`,
  PASSWORD_STRENGTH: `${API_BASE_URL}/passwords/check-strength`,

  // User endpoints for ATP
  SEND_VERIFICATION_CODE: '/api/auth/verification/send-code',
  COMPLETE_VERIFICATION: '/api/auth/verification/complete',
  
  // Admin endpoints for ATP
  SUSPICIOUS_ACTIVITIES: '/api/admin/suspicious-activities',
  REVIEW_ACTIVITY: (id) => `/api/admin/suspicious-activities/${id}/review`,
  USER_ACTIVITIES: (id) => `/api/admin/user/${id}/activities`,
  SET_USER_MONITORING: (id) => `/api/admin/user/${id}/monitoring`,
};

// Error types for better error handling
export const ErrorTypes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
};

// Improved fetch with CSRF protection and standardized error handling
export const fetchWithCSRF = async (url, options = {}) => {
  try {
    // First get CSRF token if needed
    const csrfResponse = await fetch('/api/auth/csrf-token', {
      credentials: 'include',
    });
    
    if (!csrfResponse.ok) {
      throw { 
        type: ErrorTypes.AUTH_ERROR,
        status: csrfResponse.status,
        message: 'Failed to get CSRF token'
      };
    }
    
    const { csrfToken } = await csrfResponse.json();
    
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
    
    const data = await response.json();
    
    // Check for verification requirement
    if (response.status === 403 && data.requiresVerification) {
      // Store verification requirements in session storage
      if (data.verificationRequirements) {
        sessionStorage.setItem('verificationRequirements', JSON.stringify(data.verificationRequirements));
      }
      
      throw {
        type: ErrorTypes.VERIFICATION_REQUIRED,
        status: response.status,
        message: data.message || 'Additional verification required',
        verificationRequirements: data.verificationRequirements
      };
    }
    
    // Handle other error responses
    if (!response.ok) {
      const errorType = response.status === 401 ? ErrorTypes.AUTH_ERROR :
                         response.status === 400 ? ErrorTypes.VALIDATION_ERROR :
                         response.status >= 500 ? ErrorTypes.SERVER_ERROR :
                         ErrorTypes.UNKNOWN_ERROR;
      
      throw {
        type: errorType,
        status: response.status,
        message: data.message || 'An error occurred'
      };
    }
    
    return data;
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