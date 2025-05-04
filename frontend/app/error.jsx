'use client';

import { useEffect } from 'react';
import { AlertTriangle, Home, RefreshCw, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useErrorHandling } from '@/contexts/ErrorHandlingContext';
import { isOffline } from '@/lib/offline-handler';
import { getErrorMessage } from '@/lib/i18n/error-messages';

/**
 * Global error page component
 * This is a Next.js error boundary that will catch unhandled errors
 * in the page component hierarchy
 */
export default function ErrorPage({ error, reset }) {
  const { reportError } = useErrorHandling();
  
  // Report the error when the component mounts
  useEffect(() => {
    // Report error to our tracking system
    reportError(error, { 
      context: { page: 'global-error', source: 'error-boundary' }
    });
    
    // Log to console in development
    console.error('Global error caught by error boundary:', error);
  }, [error, reportError]);
  
  // Check if we're offline
  const offline = isOffline();
  
  // Get a user-friendly error message
  const errorMessage = getErrorMessage(error?.message || 'UNEXPECTED_ERROR');
  
  // Provide specific guidance based on error type
  const getErrorGuidance = () => {
    if (offline) {
      return {
        title: 'You are currently offline',
        description: 'Please check your internet connection and try again. Some features may still be available in offline mode.',
        additionalHelp: 'Your securely encrypted data is stored locally and will sync when you reconnect.'
      };
    }
    
    // Use error.type to provide specific guidance
    switch (error?.type) {
      case 'AUTHENTICATION_ERROR':
        return {
          title: 'Authentication Problem',
          description: 'You may need to sign in again to continue.',
          additionalHelp: 'For security reasons, authentication sessions expire periodically.'
        };
        
      case 'AUTHORIZATION_ERROR':
        return {
          title: 'Access Denied',
          description: 'You don\'t have permission to access this resource.',
          additionalHelp: 'If you believe this is an error, please contact support.'
        };
        
      case 'RATE_LIMIT_ERROR':
        return {
          title: 'Too Many Requests',
          description: 'Please wait before trying again.',
          additionalHelp: 'Rate limits help protect our service from abuse.'
        };
        
      case 'NETWORK_ERROR':
        return {
          title: 'Network Problem',
          description: 'There was a problem connecting to our servers.',
          additionalHelp: 'This could be due to your network connection or our servers may be experiencing issues.'
        };
        
      case 'SERVER_ERROR':
        return {
          title: 'Server Error',
          description: 'Our servers are experiencing a problem.',
          additionalHelp: 'Our team has been notified and is working to fix this issue.'
        };
        
      default:
        return {
          title: 'Something Went Wrong',
          description: 'An unexpected error occurred.',
          additionalHelp: 'Try refreshing the page or go back to the home page.'
        };
    }
  };
  
  const guidance = getErrorGuidance();
  
  return (
    <div className="flex items-center justify-center min-h-[80vh] bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg text-center">
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="h-10 w-10 text-red-600" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {guidance.title}
        </h1>
        
        <p className="text-gray-600 mb-6">
          {guidance.description}
        </p>
        
        {errorMessage && (
          <div className="bg-gray-100 p-4 rounded-md mb-6 text-left">
            <p className="text-sm text-gray-700 font-mono">{errorMessage}</p>
          </div>
        )}
        
        <div className="text-gray-500 mb-8 text-sm">
          {guidance.additionalHelp}
        </div>
        
        <div className="flex flex-col space-y-3">
          <Button 
            onClick={() => reset()} 
            className="w-full flex items-center justify-center"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full flex items-center justify-center"
            onClick={() => window.location.href = '/'}
          >
            <Home className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full flex items-center justify-center"
            onClick={() => window.location.href = '/help'}
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            Get Help
          </Button>
        </div>
        
        <div className="mt-8 text-xs text-gray-400">
          Error ID: {error?.id || 'unknown'}
        </div>
      </div>
    </div>
  );
}
