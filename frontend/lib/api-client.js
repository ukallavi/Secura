// frontend/lib/api-client.js
import { ENDPOINTS, fetchWithCSRF, ErrorTypes } from './api-config';
import logger from './logger';

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
        throw new Error('Failed to fetch passwords');
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Error fetching passwords:', error);
      throw error;
    }
  },
  
  // Get a single password by ID
  getById: async (id) => {
    try {
      const response = await fetch(`${ENDPOINTS.PASSWORDS}/${id}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch password');
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Error fetching password:', error);
      throw error;
    }
  },
  
  // Create a new password
  create: async (passwordData) => {
    try {
      const response = await fetchWithCSRF(ENDPOINTS.PASSWORDS, {
        method: 'POST',
        body: JSON.stringify(passwordData)
      });
      
      return await response.json();
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
      
      return await response.json();
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
        throw new Error('Failed to generate password');
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Error generating password:', error);
      throw error;
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
        throw new Error('Failed to check password strength');
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Error checking password strength:', error);
      throw error;
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
        throw new Error('Failed to fetch user profile');
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Error fetching user profile:', error);
      throw error;
    }
  },
  
  // Update user profile
  updateProfile: async (profileData) => {
    try {
      const response = await fetchWithCSRF(ENDPOINTS.PROFILE, {
        method: 'PUT',
        body: JSON.stringify(profileData)
      });
      
      return await response.json();
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
      
      return await response.json();
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
      
      return response.ok;
    } catch (error) {
      logger.error('Error verifying 2FA:', error);
      throw error;
    }
  },
  
  // Disable two-factor authentication
  disableTwoFactor: async () => {
    try {
      const response = await fetchWithCSRF(`${ENDPOINTS.TWO_FACTOR}/disable`, {
        method: 'POST'
      });
      
      return response.ok;
    } catch (error) {
      logger.error('Error disabling 2FA:', error);
      throw error;
    }
  }
};

// Admin API client
export const AdminApi = {
  // Get all users (admin only)
  getAllUsers: async (page = 1, limit = 10) => {
    try {
      const response = await fetch(
        `${ENDPOINTS.ADMIN_USERS}?page=${page}&limit=${limit}`,
        { credentials: 'include' }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Error fetching users:', error);
      throw error;
    }
  },
  
  // Get user by ID (admin only)
  getUserById: async (id) => {
    try {
      const response = await fetch(`${ENDPOINTS.ADMIN_USERS}/${id}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }
      
      return await response.json();
    } catch (error) {
      logger.error('Error fetching user:', error);
      throw error;
    }
  },
  
  // Update user (admin only)
  updateUser: async (id, userData) => {
    try {
      const response = await fetchWithCSRF(`${ENDPOINTS.ADMIN_USERS}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(userData)
      });
      
      return await response.json();
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  },
  
  // Delete user (admin only)
  deleteUser: async (id) => {
    try {
      const response = await fetchWithCSRF(`${ENDPOINTS.ADMIN_USERS}/${id}`, {
        method: 'DELETE'
      });
      
      return response.ok;
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }
};