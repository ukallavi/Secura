"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { initErrorTracking } from '@/lib/error-tracking';
import { setLanguage } from '@/lib/i18n/error-messages';

// Create context
const ErrorHandlingContext = createContext({
  handleError: () => {},
  reportError: () => {}, // Add reportError to the context
  setErrorLanguage: () => {},
  errorStats: { count: 0 },
});

/**
 * Provider component for error handling functionality
 */
export function ErrorHandlingProvider({ children }) {
  const { toast } = useToast();
  const [errorStats, setErrorStats] = useState({ count: 0 });
  const [language, setLanguage] = useState('en');

  // Initialize error tracking on mount
  useEffect(() => {
    initErrorTracking();
    
    // Track error stats
    const updateErrorStats = (event) => {
      setErrorStats(prev => ({
        ...prev,
        count: prev.count + 1,
        lastError: new Date().toISOString(),
      }));
    };
    
    // Listen for custom error events
    window.addEventListener('secura:error', updateErrorStats);
    
    return () => {
      window.removeEventListener('secura:error', updateErrorStats);
    };
  }, []);
  
  // Update language when it changes
  useEffect(() => {
    setLanguage(language);
  }, [language]);
  
  /**
   * Set the language for error messages
   * @param {string} lang - Language code (e.g., 'en', 'es')
   */
  const setErrorLanguage = (lang) => {
    setLanguage(lang);
  };
  
  /**
   * Handle an error with appropriate UI feedback
   * @param {Error|Object} error - Error object
   * @param {Object} options - Options for error handling
   */
  const handleError = (error, options = {}) => {
    const {
      title = 'Error',
      showToast = true,
      logToConsole = true,
      track = true,
      context = {},
    } = options;
    
    // Log to console if enabled
    if (logToConsole) {
      console.error('Error handled by ErrorHandlingContext:', error);
    }
    
    // Track the error if enabled
    if (track) {
      // Import dynamically to avoid SSR issues
      import('@/lib/error-tracking').then(({ trackError }) => {
        trackError(error, context);
      });
      
      // Dispatch custom event for stats tracking
      window.dispatchEvent(new CustomEvent('secura:error', { detail: error }));
    }
    
    // Show toast if enabled
    if (showToast) {
      toast({
        title,
        description: error.message || 'An unexpected error occurred',
        variant: 'destructive',
        duration: 5000,
      });
    }
  };
  
  // Context value
  const value = {
    handleError,
    reportError: handleError, // Alias handleError as reportError for backward compatibility
    setErrorLanguage,
    errorStats,
  };
  
  return (
    <ErrorHandlingContext.Provider value={value}>
      {children}
    </ErrorHandlingContext.Provider>
  );
}

/**
 * Hook to use the error handling context
 * @returns {Object} Error handling methods and state
 */
export function useErrorHandling() {
  const context = useContext(ErrorHandlingContext);
  
  if (context === undefined) {
    throw new Error('useErrorHandling must be used within an ErrorHandlingProvider');
  }
  
  return context;
}
