// frontend/lib/auth-error-handler.js
import { processApiError, ErrorTypes } from './error-handler';
import { useRouter } from 'next/navigation';

/**
 * Specialized error handler for authentication-related errors
 * @param {Error|Response} error - The error or response object
 * @param {Object} options - Options for error handling
 * @param {Function} options.onAuthError - Callback for authentication errors
 * @param {Function} options.onVerificationRequired - Callback for verification required
 * @param {Function} options.onOtherError - Callback for other errors
 * @returns {Promise<void>}
 */
export const handleAuthError = async (error, options = {}) => {
  try {
    const processedError = error.type ? error : await processApiError(error);
    
    // Log the error for debugging
    console.error('Authentication error:', processedError);
    
    // Handle based on error type
    switch (processedError.type) {
      case ErrorTypes.AUTH_ERROR:
        // Authentication errors (invalid credentials, token expired, etc.)
        if (options.onAuthError) {
          options.onAuthError(processedError);
        } else {
          // Default behavior: redirect to login
          const router = useRouter();
          router.push('/login?error=session_expired');
          
          // Clear any auth tokens
          localStorage.removeItem('auth_token');
          sessionStorage.removeItem('auth_state');
        }
        break;
        
      case ErrorTypes.VERIFICATION_REQUIRED:
        // Additional verification required (2FA, etc.)
        if (options.onVerificationRequired) {
          options.onVerificationRequired(processedError);
        } else {
          // Default behavior: redirect to verification page
          const router = useRouter();
          
          // Store verification requirements in session storage
          if (processedError.verificationRequirements) {
            sessionStorage.setItem(
              'verificationRequirements', 
              JSON.stringify(processedError.verificationRequirements)
            );
          }
          
          router.push('/verify');
        }
        break;
        
      case ErrorTypes.RATE_LIMIT_ERROR:
        // Too many login attempts
        if (options.onRateLimitError) {
          options.onRateLimitError(processedError);
        } else {
          // Show lockout message with retry time if available
          const retryAfter = processedError.retryAfter || 60;
          alert(`Too many login attempts. Please try again after ${retryAfter} seconds.`);
        }
        break;
        
      default:
        // Handle any other errors
        if (options.onOtherError) {
          options.onOtherError(processedError);
        } else {
          alert(`Error: ${processedError.message || 'An unknown error occurred'}`);
        }
    }
  } catch (err) {
    console.error('Error in handleAuthError:', err);
    alert('An unexpected error occurred during authentication.');
  }
};

/**
 * React hook for handling authentication errors
 * @returns {Object} Auth error handling methods
 */
export const useAuthErrorHandler = () => {
  const router = useRouter();
  
  return {
    /**
     * Handle login errors
     * @param {Error|Response} error - The error or response object
     * @param {Object} options - Additional options
     */
    handleLoginError: async (error, options = {}) => {
      await handleAuthError(error, {
        onAuthError: (err) => {
          // For login, show specific error message
          const message = err.message || 'Invalid username or password';
          if (options.setError) {
            options.setError('credentials', { message });
          }
        },
        onVerificationRequired: (err) => {
          // Redirect to verification with context
          if (err.verificationRequirements) {
            sessionStorage.setItem(
              'verificationRequirements', 
              JSON.stringify(err.verificationRequirements)
            );
          }
          router.push('/verify');
        },
        onRateLimitError: (err) => {
          // Show lockout message with countdown
          const retryAfter = err.retryAfter || 60;
          if (options.setError) {
            options.setError('credentials', { 
              message: `Too many login attempts. Please try again after ${retryAfter} seconds.` 
            });
          }
        },
        onOtherError: (err) => {
          // Generic error handling
          if (options.setError) {
            options.setError('root', { 
              message: err.message || 'An error occurred during login' 
            });
          }
        }
      });
    },
    
    /**
     * Handle registration errors
     * @param {Error|Response} error - The error or response object
     * @param {Object} options - Additional options
     */
    handleRegistrationError: async (error, options = {}) => {
      try {
        const processedError = error.type ? error : await processApiError(error);
        
        // Handle validation errors specially for registration
        if (processedError.type === ErrorTypes.VALIDATION_ERROR && processedError.errors) {
          // Map backend validation errors to form fields
          processedError.errors.forEach(fieldError => {
            if (options.setError && fieldError.field) {
              options.setError(fieldError.field, { message: fieldError.message });
            }
          });
        } else {
          // Use general auth error handler for other errors
          await handleAuthError(processedError, {
            onOtherError: (err) => {
              if (options.setError) {
                options.setError('root', { 
                  message: err.message || 'An error occurred during registration' 
                });
              }
            }
          });
        }
      } catch (err) {
        console.error('Error in handleRegistrationError:', err);
        if (options.setError) {
          options.setError('root', { 
            message: 'An unexpected error occurred during registration' 
          });
        }
      }
    },
    
    /**
     * Handle logout errors
     * @param {Error|Response} error - The error or response object
     */
    handleLogoutError: async (error) => {
      // For logout, we don't care much about the specific error
      // Just log it and redirect to login anyway
      console.error('Logout error:', error);
      
      // Clear any auth tokens regardless of error
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_state');
      
      // Redirect to login
      router.push('/login');
    }
  };
};
