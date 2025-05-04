"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { initOfflineHandling, subscribeToOfflineStatus } from '@/lib/offline-handler';

// Create context
const ServiceWorkerContext = createContext({
  isOnline: true,
  isUpdateAvailable: false,
  updateServiceWorker: () => {},
});

/**
 * Provider component for service worker functionality
 */
export function ServiceWorkerProvider({ children }) {
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(true);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState(null);
  
  // Register service worker on mount
  useEffect(() => {
    // Initialize offline handling
    initOfflineHandling();
    
    // Subscribe to offline status changes
    const unsubscribe = subscribeToOfflineStatus((offline) => {
      setIsOnline(!offline);
      
      // Show toast when connection status changes
      if (offline) {
        toast({
          title: 'You are offline',
          description: 'Some features may be limited while offline',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Back online',
          description: 'Your connection has been restored',
          variant: 'default',
        });
        
        // Store last sync time when coming back online
        localStorage.setItem('last_sync_time', Date.now().toString());
      }
    });
    
    // Register service worker if supported
    if ('serviceWorker' in navigator) {
      registerServiceWorker();
    }
    
    return () => {
      unsubscribe();
    };
  }, [toast]);
  
  /**
   * Register the service worker
   */
  const registerServiceWorker = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/service-worker.js');
      setRegistration(reg);
      
      // Check for updates
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New content is available
            setIsUpdateAvailable(true);
            
            toast({
              title: 'Update available',
              description: 'A new version of Secura is available. Click to update.',
              action: {
                label: 'Update',
                onClick: () => updateServiceWorker(),
              },
              duration: 10000,
            });
          }
        });
      });
      
      // Handle controller change (after skipWaiting)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Reload the page after the new service worker takes control
        window.location.reload();
      });
      
      console.log('Service Worker registered successfully');
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  };
  
  /**
   * Update the service worker
   */
  const updateServiceWorker = () => {
    if (!registration) return;
    
    // Send skip waiting message to the waiting service worker
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };
  
  // Context value
  const value = {
    isOnline,
    isUpdateAvailable,
    updateServiceWorker,
  };
  
  return (
    <ServiceWorkerContext.Provider value={value}>
      {children}
    </ServiceWorkerContext.Provider>
  );
}

/**
 * Hook to use the service worker context
 * @returns {Object} Service worker state and methods
 */
export function useServiceWorker() {
  const context = useContext(ServiceWorkerContext);
  
  if (context === undefined) {
    throw new Error('useServiceWorker must be used within a ServiceWorkerProvider');
  }
  
  return context;
}
