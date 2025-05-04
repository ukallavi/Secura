import { processApiError } from './error-handler';

/**
 * Secure fetch with CSRF protection and error handling
 * @param {string} url - The API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} The parsed JSON response
 * @throws {Object} Standardized error object
 */
export const fetchWithCSRF = async (url, options = {}) => {
  try {
    // Always include credentials for session-based auth
    const csrfResponse = await fetch('/api/csrf-token', {
      credentials: 'include',
    });
    if (!csrfResponse.ok) {
      throw await processApiError(csrfResponse);
    }
    const { csrfToken } = await csrfResponse.json();

    const headers = {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      ...options.headers,
    };
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
    if (!response.ok) {
      throw await processApiError(response);
    }
    return await response.json();
  } catch (error) {
    if (error.type) {
      throw error;
    }
    throw await processApiError(error);
  }
};
