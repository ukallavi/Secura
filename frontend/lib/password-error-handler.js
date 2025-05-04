// frontend/lib/password-error-handler.js
import { processApiError, ErrorTypes } from './error-handler';
import { useRouter } from 'next/navigation';

/**
 * Specialized error handler for password-related operations
 * @param {Error|Response} error - The error or response object
 * @param {Object} options - Options for error handling
 * @returns {Promise<void>}
 */
export const handlePasswordError = async (error, options = {}) => {
  try {
    const processedError = error.type ? error : await processApiError(error);
    
    // Log the error for debugging
    console.error('Password operation error:', processedError);
    
    // Handle based on error type
    switch (processedError.type) {
      case ErrorTypes.AUTH_ERROR:
        // Authentication errors during password operations
        if (options.onAuthError) {
          options.onAuthError(processedError);
        } else {
          // Default behavior: redirect to login
          const router = useRouter();
          router.push('/login?error=session_expired');
        }
        break;
        
      case ErrorTypes.VALIDATION_ERROR:
        // Validation errors (weak password, etc.)
        if (options.onValidationError) {
          options.onValidationError(processedError);
        } else if (processedError.errors && options.setError) {
          // Map validation errors to form fields
          processedError.errors.forEach(fieldError => {
            if (fieldError.field) {
              options.setError(fieldError.field, { message: fieldError.message });
            }
          });
        } else {
          // Generic validation error
          const message = processedError.message || 'Validation failed';
          if (options.setError) {
            options.setError('root', { message });
          } else if (options.toast) {
            options.toast({
              title: 'Validation Error',
              description: message,
              variant: 'destructive'
            });
          }
        }
        break;
        
      case ErrorTypes.FORBIDDEN_ERROR:
        // Permission errors (trying to access another user's password)
        if (options.onForbiddenError) {
          options.onForbiddenError(processedError);
        } else if (options.toast) {
          options.toast({
            title: 'Access Denied',
            description: processedError.message || 'You do not have permission to perform this action',
            variant: 'destructive'
          });
        }
        break;
        
      case ErrorTypes.NOT_FOUND_ERROR:
        // Password not found
        if (options.onNotFoundError) {
          options.onNotFoundError(processedError);
        } else if (options.toast) {
          options.toast({
            title: 'Not Found',
            description: processedError.message || 'The requested password was not found',
            variant: 'destructive'
          });
        }
        break;
        
      case ErrorTypes.SERVER_ERROR:
        // Server errors during password operations
        if (options.onServerError) {
          options.onServerError(processedError);
        } else if (options.toast) {
          options.toast({
            title: 'Server Error',
            description: 'An error occurred while processing your request. Please try again later.',
            variant: 'destructive'
          });
          
          // Log the error for investigation
          console.error('Server error during password operation:', processedError);
        }
        break;
        
      case ErrorTypes.NETWORK_ERROR:
        // Network errors
        if (options.onNetworkError) {
          options.onNetworkError(processedError);
        } else if (options.toast) {
          options.toast({
            title: 'Network Error',
            description: 'Unable to connect to the server. Please check your internet connection.',
            variant: 'destructive'
          });
        }
        break;
        
      default:
        // Handle any other errors
        if (options.onOtherError) {
          options.onOtherError(processedError);
        } else if (options.toast) {
          options.toast({
            title: 'Error',
            description: processedError.message || 'An unknown error occurred',
            variant: 'destructive'
          });
        }
    }
  } catch (err) {
    console.error('Error in handlePasswordError:', err);
    if (options.toast) {
      options.toast({
        title: 'Unexpected Error',
        description: 'An unexpected error occurred while processing your request',
        variant: 'destructive'
      });
    }
  }
};

/**
 * React hook for handling password-related errors
 * @param {Object} dependencies - Dependencies for the hook
 * @param {Function} dependencies.toast - Toast notification function
 * @returns {Object} Password error handling methods
 */
export const usePasswordErrorHandler = ({ toast }) => {
  const router = useRouter();
  
  return {
    /**
     * Handle errors when creating a password
     * @param {Error|Response} error - The error or response object
     * @param {Object} options - Additional options
     */
    handleCreateError: async (error, options = {}) => {
      await handlePasswordError(error, {
        toast,
        setError: options.setError,
        onAuthError: () => {
          // Redirect to login if session expired
          router.push('/login?error=session_expired&redirect=/passwords/new');
        },
        onValidationError: (err) => {
          // Map validation errors to form fields
          if (err.errors && options.setError) {
            err.errors.forEach(fieldError => {
              if (fieldError.field) {
                options.setError(fieldError.field, { message: fieldError.message });
              }
            });
          } else if (options.setError) {
            options.setError('root', { 
              message: err.message || 'Please check your password details' 
            });
          }
        }
      });
    },
    
    /**
     * Handle errors when updating a password
     * @param {Error|Response} error - The error or response object
     * @param {Object} options - Additional options
     */
    handleUpdateError: async (error, options = {}) => {
      await handlePasswordError(error, {
        toast,
        setError: options.setError,
        onNotFoundError: () => {
          // Password might have been deleted
          toast({
            title: 'Password Not Found',
            description: 'This password may have been deleted. Returning to password list.',
            variant: 'destructive'
          });
          
          // Redirect after a short delay
          setTimeout(() => {
            router.push('/passwords');
          }, 2000);
        }
      });
    },
    
    /**
     * Handle errors when deleting a password
     * @param {Error|Response} error - The error or response object
     */
    handleDeleteError: async (error) => {
      await handlePasswordError(error, {
        toast,
        onNotFoundError: () => {
          // Password might have been already deleted
          toast({
            title: 'Already Deleted',
            description: 'This password has already been deleted',
            variant: 'default'
          });
          
          // Refresh the password list
          router.refresh();
        }
      });
    },
    
    /**
     * Handle errors when sharing a password
     * @param {Error|Response} error - The error or response object
     * @param {Object} options - Additional options
     */
    handleShareError: async (error, options = {}) => {
      await handlePasswordError(error, {
        toast,
        setError: options.setError,
        onValidationError: (err) => {
          // Special handling for user not found errors
          if (err.errors && err.errors.some(e => e.field === 'recipient' && e.message.includes('not found'))) {
            if (options.setError) {
              options.setError('recipient', { message: 'User not found' });
            }
          } else if (options.setError) {
            // Handle other validation errors
            err.errors?.forEach(fieldError => {
              if (fieldError.field) {
                options.setError(fieldError.field, { message: fieldError.message });
              }
            });
          }
        }
      });
    }
  };
};
