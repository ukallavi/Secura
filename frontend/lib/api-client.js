// frontend/lib/api-client.js
import { ENDPOINTS } from './api-config';
import logger from './logger';
import { processApiError, ErrorTypes } from './error-handler';

/**
 * Enhanced fetch with CSRF protection
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Response data
 */
// Helper to ensure all values in an object are strictly boolean
export function sanitizeBooleans(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized = {};
  for (const key in obj) {
    sanitized[key] = typeof obj[key] === 'boolean' ? obj[key] : !!obj[key];
  }
  return sanitized;
}

export const fetchWithCSRF = async (url, options = {}) => {
  try {
    // Get CSRF token
    const csrfResponse = await fetch('/api/csrf-token', {
      credentials: 'include'
    });
    
    if (!csrfResponse.ok) {
      throw await processApiError(csrfResponse);
    }
    
    const { csrfToken } = await csrfResponse.json();
    
    // Set up headers
    const headers = {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      ...options.headers
    };
    
    // Make the actual request
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw await processApiError(response);
    }
    
    return await response.json();
  } catch (error) {
    if (error.type) {
      // Already processed by processApiError
      throw error;
    }
    
    // Process other errors
    throw await processApiError(error);
  }
};

// Password management API client
export const PasswordsApi = {
  // Get all passwords with pagination and search
  getAll: async (page = 1, limit = 10, search = '') => {
    try {
      const response = await fetch(
        `${ENDPOINTS.PASSWORDS}?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
        { credentials: 'include' }
      );
      
      if (!response.ok) {
        throw await processApiError(response);
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Error fetching passwords:', error);
      if (error.type) {
        // Already processed by processApiError
        throw error;
      }
      throw await processApiError(error);
    }
  },
  
  // Get a single password by ID
  getById: async (id) => {
    try {
      const response = await fetch(`${ENDPOINTS.PASSWORDS}/${id}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw await processApiError(response);
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Error fetching password:', error);
      if (error.type) {
        // Already processed by processApiError
        throw error;
      }
      throw await processApiError(error);
    }
  },
  
  // Create a new password
  create: async (passwordData) => {
    try {
      const response = await fetchWithCSRF(ENDPOINTS.PASSWORDS, {
        method: 'POST',
        body: JSON.stringify(passwordData)
      });
      
      return response;
    } catch (error) {
      logger.error('Error creating password:', error);
      throw error;
    }
  },
  
  // Update an existing password
  update: async (id, passwordData) => {
    try {
      const response = await fetchWithCSRF(`${ENDPOINTS.PASSWORDS}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(passwordData)
      });
      
      return response;
    } catch (error) {
      logger.error('Error updating password:', error);
      throw error;
    }
  },
  
  // Delete a password
  delete: async (id) => {
    try {
      const response = await fetchWithCSRF(`${ENDPOINTS.PASSWORDS}/${id}`, {
        method: 'DELETE'
      });
      
      return response.ok;
    } catch (error) {
      logger.error('Error deleting password:', error);
      throw error;
    }
  },
  
  // Generate a secure password
  generate: async (options = {}) => {
    try {
      const response = await fetch(ENDPOINTS.GENERATE_PASSWORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw await processApiError(response);
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Error generating password:', error);
      if (error.type) {
        // Already processed by processApiError
        throw error;
      }
      throw await processApiError(error);
    }
  },
  
  // Check password strength
  checkStrength: async (password) => {
    try {
      const response = await fetch(ENDPOINTS.PASSWORD_STRENGTH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw await processApiError(response);
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Error checking password strength:', error);
      if (error.type) {
        // Already processed by processApiError
        throw error;
      }
      throw await processApiError(error);
    }
  }
};

// User management API client
export const UsersApi = {
  // Get current user profile
  getProfile: async () => {
    try {
      const response = await fetch(ENDPOINTS.PROFILE, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw await processApiError(response);
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Error fetching user profile:', error);
      if (error.type) {
        // Already processed by processApiError
        throw error;
      }
      throw await processApiError(error);
    }
  },
  
  // Update user profile
  updateProfile: async (profileData) => {
    try {
      const response = await fetchWithCSRF(ENDPOINTS.PROFILE, {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });
      
      return response;
    } catch (error) {
      logger.error('Error updating user profile:', error);
      throw error;
    }
  },
  
  // Change password
  changePassword: async (passwordData) => {
    try {
      const response = await fetchWithCSRF(`${ENDPOINTS.PROFILE}/password`, {
        method: 'PUT',
        body: JSON.stringify(passwordData)
      });
      
      return response.ok;
    } catch (error) {
      logger.error('Error changing password:', error);
      throw error;
    }
  },
  
  // Setup two-factor authentication
  setupTwoFactor: async () => {
    try {
      const response = await fetchWithCSRF(`${ENDPOINTS.TWO_FACTOR}/setup`, {
        method: 'POST'
      });
      
      return response;
    } catch (error) {
      logger.error('Error setting up 2FA:', error);
      throw error;
    }
  },
  
  // Verify two-factor authentication
  verifyTwoFactor: async (token) => {
    try {
      const response = await fetchWithCSRF(ENDPOINTS.VERIFY_TWO_FACTOR, {
        method: 'POST',
        body: JSON.stringify({ token })
      });
      
      if (!response.ok) {
        throw await processApiError(response);
      }
      
      return response.ok;
    } catch (error) {
      logger.error('Error verifying 2FA:', error);
      if (error.type) {
        // Already processed by processApiError
        throw error;
      }
      throw await processApiError(error);
    }
  },
  
  // Disable two-factor authentication
  disableTwoFactor: async () => {
    try {
      const response = await fetchWithCSRF(`${ENDPOINTS.TWO_FACTOR}/disable`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw await processApiError(response);
      }
      
      return response.ok;
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      if (error.type) {
        // Already processed by processApiError
        throw error;
      }
      throw await processApiError(error);
    }
  }
};

// Admin API client
export const AdminApi = {
  // Get error statistics (admin only)
  getErrorStats: (timeRange = '24h') => {
    const url = `${ENDPOINTS.ADMIN_ERROR_STATS}?timeRange=${encodeURIComponent(timeRange)}`;
    return fetchWithCSRF(url)
      .then(res => res)
      .catch(err => { throw err; });
  },
  // Get error details (admin only)
  getErrorDetails: (errorId) => {
    const url = ENDPOINTS.ADMIN_ERROR_DETAILS(errorId);
    return fetchWithCSRF(url)
      .then(res => res)
      .catch(err => { throw err; });
  },
  
  // Resolve an error (admin only)
  resolveError: async (errorId, notes = '') => {
    try {
      const response = await fetchWithCSRF(`${ENDPOINTS.ADMIN_ERROR_TRACKING}/${errorId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ notes })
      });
      
      if (!response.ok) {
        throw await processApiError(response);
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Error resolving error:', error);
      if (error.type) {
        // Already processed by processApiError
        throw error;
      }
      throw await processApiError(error);
    }
  },
  
  // Get all users (admin only)
  getAllUsers: async (page = 1, limit = 10) => {
    try {
      const response = await fetch(`${ENDPOINTS.ADMIN_USERS}?page=${page}&limit=${limit}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw await processApiError(response);
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Error fetching users:', error);
      if (error.type) {
        // Already processed by processApiError
        throw error;
      }
      throw await processApiError(error);
    }
  },
  
  // Get user by ID (admin only)
  getUserById: async (id) => {
    try {
      const response = await fetch(`${ENDPOINTS.ADMIN_USERS}/${id}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw await processApiError(response);
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Error fetching user:', error);
      if (error.type) {
        // Already processed by processApiError
        throw error;
      }
      throw await processApiError(error);
    }
  },
  
  // Update user (admin only)
  updateUser: async (id, userData) => {
    try {
      const response = await fetchWithCSRF(`${ENDPOINTS.ADMIN_USERS}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        throw await processApiError(response);
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Error updating user:', error);
      if (error.type) {
        // Already processed by processApiError
        throw error;
      }
      throw await processApiError(error);
    }
  },
  
  // Delete user (admin only)
  deleteUser: async (id) => {
    try {
      const response = await fetchWithCSRF(`${ENDPOINTS.ADMIN_USERS}/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw await processApiError(response);
      }
      
      return response.ok;
    } catch (error) {
      logger.error('Error deleting user:', error);
      if (error.type) {
        // Already processed by processApiError
        throw error;
      }
      throw await processApiError(error);
    }
  }
};