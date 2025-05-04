/**
 * Centralized error handling for the frontend application
 */

// Error types for better categorization
export const ErrorTypes = {
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  SERVER: 'SERVER_ERROR',
  NETWORK: 'NETWORK_ERROR',
  NOT_FOUND: 'NOT_FOUND_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR'
};

/**
 * Map HTTP status codes to error types
 * @param {number} statusCode - HTTP status code
 * @returns {string} Error type
 */
export const mapStatusToErrorType = (statusCode) => {
  if (!statusCode) return ErrorTypes.UNKNOWN;
  
  switch (statusCode) {
    case 400:
      return ErrorTypes.VALIDATION;
    case 401:
      return ErrorTypes.AUTHENTICATION;
    case 403:
      return ErrorTypes.AUTHORIZATION;
    case 404:
      return ErrorTypes.NOT_FOUND;
    case 500:
    case 502:
    case 503:
    case 504:
      return ErrorTypes.SERVER;
    default:
      return ErrorTypes.UNKNOWN;
  }
};

/**
 * Create a standardized error object
 * @param {string} message - Error message
 * @param {string} type - Error type from ErrorTypes
 * @param {Object} details - Additional error details
 * @returns {Object} Standardized error object
 */
export const createError = (message, type = ErrorTypes.UNKNOWN, details = {}) => {
  return {
    message,
    type,
    details,
    timestamp: new Date().toISOString()
  };
};

/**
 * Process API error responses
 * @param {Error|Response} error - Error object or response
 * @returns {Object} Processed error object
 */
export const processApiError = async (error) => {
  // Network error (no response)
  if (!error.status && !error.response) {
    return createError(
      'Network error. Please check your internet connection.',
      ErrorTypes.NETWORK
    );
  }
  
  // Error with response
  if (error.status || error.response) {
    const response = error.response || error;
    const status = response.status;
    
    try {
      // Try to parse error response body
      const data = await response.json();
      return createError(
        data.message || data.error || 'An unexpected error occurred',
        mapStatusToErrorType(status),
        { status, data }
      );
    } catch (e) {
      // Can't parse JSON response
      return createError(
        'An unexpected error occurred',
        mapStatusToErrorType(status),
        { status }
      );
    }
  }
  
  // Default error handling
  return createError(
    error.message || 'An unexpected error occurred',
    ErrorTypes.UNKNOWN,
    { originalError: error }
  );
};

/**
 * Handle errors and display appropriate UI feedback
 * @param {Object} error - Error object
 * @param {Function} toast - Toast notification function
 * @param {Function} router - Next.js router
 */
export const handleError = (error, toast, router) => {
  console.error('Error occurred:', error);
  
  // Display toast notification
  if (toast) {
    toast({
      variant: "destructive",
      title: getErrorTitle(error.type),
      description: error.message || 'An unexpected error occurred'
    });
  }
  
  // Handle authentication errors
  if (error.type === ErrorTypes.AUTHENTICATION) {
    // Redirect to login page
    if (router && !window.location.pathname.includes('/login')) {
      router.push('/login');
    }
  }
  
  // Log error to monitoring service (if implemented)
  // logErrorToMonitoring(error);
};

/**
 * Get user-friendly error title based on error type
 * @param {string} errorType - Error type from ErrorTypes
 * @returns {string} User-friendly error title
 */
export const getErrorTitle = (errorType) => {
  switch (errorType) {
    case ErrorTypes.AUTHENTICATION:
      return 'Authentication Error';
    case ErrorTypes.AUTHORIZATION:
      return 'Permission Denied';
    case ErrorTypes.VALIDATION:
      return 'Validation Error';
    case ErrorTypes.SERVER:
      return 'Server Error';
    case ErrorTypes.NETWORK:
      return 'Network Error';
    case ErrorTypes.NOT_FOUND:
      return 'Not Found';
    default:
      return 'Error';
  }
};

export default {
  ErrorTypes,
  createError,
  processApiError,
  handleError,
  mapStatusToErrorType,
  getErrorTitle
};
