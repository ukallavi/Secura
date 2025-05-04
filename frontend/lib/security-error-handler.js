// frontend/lib/security-error-handler.js
import { processApiError, ErrorTypes } from './error-handler';
import { useRouter } from 'next/navigation';

/**
 * Specialized error handler for security-sensitive operations
 * @param {Error|Response} error - The error or response object
 * @param {Object} options - Options for error handling
 * @returns {Promise<void>}
 */
export const handleSecurityError = async (error, options = {}) => {
  try {
    const processedError = error.type ? error : await processApiError(error);
    
    // Log the error for security auditing
    console.error('Security operation error:', processedError);
    
    // For security operations, we want to be extra careful with error handling
    switch (processedError.type) {
      case ErrorTypes.AUTH_ERROR:
        // Authentication errors during security operations are high priority
        if (options.onAuthError) {
          options.onAuthError(processedError);
        } else {
          // Force logout for security
          localStorage.removeItem('auth_token');
          sessionStorage.removeItem('auth_state');
          
          // Redirect to login with security warning
          const router = useRouter();
          router.push('/login?error=security_auth_failure');
          
          // Show a serious warning
          if (options.toast) {
            options.toast({
              title: 'Security Alert',
              description: 'Your session has expired or is invalid. Please log in again.',
              variant: 'destructive',
              duration: 6000
            });
          }
        }
        break;
        
      case ErrorTypes.VERIFICATION_REQUIRED:
        // Additional verification required for sensitive operations
        if (options.onVerificationRequired) {
          options.onVerificationRequired(processedError);
        } else {
          // Store verification requirements
          if (processedError.verificationRequirements) {
            sessionStorage.setItem(
              'verificationRequirements', 
              JSON.stringify({
                ...processedError.verificationRequirements,
                returnPath: window.location.pathname // Store current path for return
              })
            );
          }
          
          // Redirect to verification
          const router = useRouter();
          router.push('/verify?reason=security_operation');
          
          if (options.toast) {
            options.toast({
              title: 'Verification Required',
              description: 'Additional verification is required for this security-sensitive operation.',
              variant: 'default',
              duration: 5000
            });
          }
        }
        break;
        
      case ErrorTypes.FORBIDDEN_ERROR:
        // Permission errors in security context could indicate attempted breach
        if (options.onForbiddenError) {
          options.onForbiddenError(processedError);
        } else if (options.toast) {
          options.toast({
            title: 'Security Alert',
            description: 'You do not have permission to perform this security operation.',
            variant: 'destructive',
            duration: 5000
          });
          
          // Log security incident
          console.error('Security permission violation:', {
            path: window.location.pathname,
            timestamp: new Date().toISOString(),
            error: processedError
          });
          
          // Redirect to dashboard after delay
          setTimeout(() => {
            const router = useRouter();
            router.push('/main');
          }, 2000);
        }
        break;
        
      case ErrorTypes.RATE_LIMIT_ERROR:
        // Rate limiting in security context could indicate brute force attempt
        if (options.onRateLimitError) {
          options.onRateLimitError(processedError);
        } else if (options.toast) {
          const retryAfter = processedError.retryAfter || 60;
          
          options.toast({
            title: 'Rate Limit Exceeded',
            description: `Too many security operations attempted. Please wait ${retryAfter} seconds before trying again.`,
            variant: 'destructive',
            duration: 5000
          });
          
          // Disable form submission if a form is provided
          if (options.setFormDisabled) {
            options.setFormDisabled(true);
            
            // Re-enable after the rate limit period
            setTimeout(() => {
              options.setFormDisabled(false);
            }, retryAfter * 1000);
          }
        }
        break;
        
      case ErrorTypes.SERVER_ERROR:
        // Server errors during security operations need special handling
        if (options.onServerError) {
          options.onServerError(processedError);
        } else if (options.toast) {
          options.toast({
            title: 'Security Operation Failed',
            description: 'The server encountered an error while processing your security request. Our team has been notified.',
            variant: 'destructive',
            duration: 5000
          });
          
          // Log detailed error for security audit
          console.error('Security operation server error:', {
            path: window.location.pathname,
            timestamp: new Date().toISOString(),
            operation: options.operationType || 'unknown',
            error: processedError
          });
        }
        break;
        
      default:
        // Handle any other errors
        if (options.onOtherError) {
          options.onOtherError(processedError);
        } else if (options.toast) {
          options.toast({
            title: 'Security Operation Error',
            description: processedError.message || 'An error occurred during the security operation',
            variant: 'destructive'
          });
        }
    }
    
    // For all security errors, log an audit entry
    if (options.logSecurityAudit) {
      options.logSecurityAudit({
        type: 'SECURITY_ERROR',
        errorType: processedError.type,
        message: processedError.message,
        path: window.location.pathname,
        timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error('Error in handleSecurityError:', err);
    if (options.toast) {
      options.toast({
        title: 'Security System Error',
        description: 'An unexpected error occurred in the security system',
        variant: 'destructive'
      });
    }
  }
};

/**
 * React hook for handling security-related errors
 * @param {Object} dependencies - Dependencies for the hook
 * @param {Function} dependencies.toast - Toast notification function
 * @returns {Object} Security error handling methods
 */
export const useSecurityErrorHandler = ({ toast }) => {
  const router = useRouter();
  
  // Function to log security audit entries
  const logSecurityAudit = (entry) => {
    // In a real app, this might send to a backend API
    console.warn('Security Audit:', entry);
    
    // Store in local storage for demo purposes
    try {
      const auditLog = JSON.parse(localStorage.getItem('security_audit_log') || '[]');
      auditLog.push(entry);
      localStorage.setItem('security_audit_log', JSON.stringify(auditLog.slice(-20))); // Keep last 20 entries
    } catch (err) {
      console.error('Error logging security audit:', err);
    }
  };
  
  return {
    /**
     * Handle errors during two-factor authentication setup
     * @param {Error|Response} error - The error or response object
     * @param {Object} options - Additional options
     */
    handleTwoFactorSetupError: async (error, options = {}) => {
      await handleSecurityError(error, {
        toast,
        operationType: 'TWO_FACTOR_SETUP',
        logSecurityAudit,
        setFormDisabled: options.setFormDisabled,
        onAuthError: () => {
          // Redirect to login with return path
          router.push(`/login?error=session_expired&redirect=${encodeURIComponent('/settings/security')}`);
        }
      });
    },
    
    /**
     * Handle errors during password change
     * @param {Error|Response} error - The error or response object
     * @param {Object} options - Additional options
     */
    handlePasswordChangeError: async (error, options = {}) => {
      await handleSecurityError(error, {
        toast,
        operationType: 'PASSWORD_CHANGE',
        logSecurityAudit,
        setError: options.setError,
        onValidationError: (err) => {
          // Special handling for current password validation
          if (err.errors && err.errors.some(e => e.field === 'currentPassword')) {
            if (options.setError) {
              const passwordError = err.errors.find(e => e.field === 'currentPassword');
              options.setError('currentPassword', { 
                message: passwordError?.message || 'Current password is incorrect' 
              });
              
              // Log failed password change attempt
              logSecurityAudit({
                type: 'FAILED_PASSWORD_CHANGE',
                reason: 'INCORRECT_CURRENT_PASSWORD',
                timestamp: new Date().toISOString()
              });
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
    },
    
    /**
     * Handle errors during account recovery
     * @param {Error|Response} error - The error or response object
     * @param {Object} options - Additional options
     */
    handleAccountRecoveryError: async (error, options = {}) => {
      await handleSecurityError(error, {
        toast,
        operationType: 'ACCOUNT_RECOVERY',
        logSecurityAudit,
        setError: options.setError,
        onRateLimitError: (err) => {
          // Special handling for rate limiting during account recovery
          const retryAfter = err.retryAfter || 60;
          
          if (options.setError) {
            options.setError('root', { 
              message: `Too many recovery attempts. Please try again after ${retryAfter} seconds.` 
            });
          }
          
          if (options.setFormDisabled) {
            options.setFormDisabled(true);
            
            // Re-enable after the rate limit period
            setTimeout(() => {
              options.setFormDisabled(false);
            }, retryAfter * 1000);
          }
          
          // Log rate limit violation
          logSecurityAudit({
            type: 'RATE_LIMIT_VIOLATION',
            operation: 'ACCOUNT_RECOVERY',
            retryAfter,
            timestamp: new Date().toISOString()
          });
        }
      });
    },
    
    /**
     * Handle errors during security alert dismissal (admin function)
     * @param {Error|Response} error - The error or response object
     * @param {string} alertId - ID of the alert being dismissed
     */
    handleAlertDismissalError: async (error, alertId) => {
      await handleSecurityError(error, {
        toast,
        operationType: 'ALERT_DISMISSAL',
        logSecurityAudit,
        onForbiddenError: () => {
          toast({
            title: 'Permission Denied',
            description: 'You do not have permission to dismiss security alerts',
            variant: 'destructive'
          });
          
          // Log unauthorized dismissal attempt
          logSecurityAudit({
            type: 'UNAUTHORIZED_ALERT_DISMISSAL',
            alertId,
            timestamp: new Date().toISOString()
          });
        }
      });
    }
  };
};
