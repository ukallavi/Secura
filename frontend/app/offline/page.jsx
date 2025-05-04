// frontend/app/offline/page.jsx
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { WifiOff, RefreshCw, Database, Lock } from 'lucide-react';

export default function OfflinePage() {
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isOnline, setIsOnline] = useState(false);
  
  useEffect(() => {
    // Check online status
    setIsOnline(navigator.onLine);
    
    // Get last sync time from localStorage
    const storedSyncTime = localStorage.getItem('last_sync_time');
    if (storedSyncTime) {
      setLastSyncTime(new Date(parseInt(storedSyncTime, 10)));
    }
    
    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Format the last sync time
  const formattedSyncTime = lastSyncTime
    ? new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(lastSyncTime)
    : 'Unknown';
  
  // Handle refresh button click
  const handleRefresh = () => {
    if (isOnline) {
      window.location.href = '/main';
    } else {
      // Show a toast or alert that we're still offline
      alert('Still offline. Please check your internet connection.');
    }
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-red-600 p-6 flex justify-center">
          <WifiOff className="h-16 w-16 text-white" aria-hidden="true" />
        </div>
        
        <div className="p-6 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">You're offline</h1>
            <p className="mt-2 text-gray-600">
              Secura requires an internet connection to access your passwords securely.
            </p>
          </div>
          
          <div className="border-t border-b border-gray-200 py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Connection status:</span>
              <span className={`font-medium ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {isOnline ? 'Back online' : 'Offline'}
              </span>
            </div>
            
            {lastSyncTime && (
              <div className="flex items-center justify-between text-sm mt-3">
                <span className="text-gray-500">Last synced:</span>
                <span className="font-medium text-gray-900">{formattedSyncTime}</span>
              </div>
            )}
          </div>
          
          <div className="space-y-4">
            <Button 
              onClick={handleRefresh}
              className="w-full flex items-center justify-center"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {isOnline ? 'Reconnect to Secura' : 'Check connection'}
            </Button>
            
            {isOnline && (
              <Link href="/main" passHref>
                <Button variant="outline" className="w-full">
                  Go to dashboard
                </Button>
              </Link>
            )}
          </div>
        </div>
        
        <div className="bg-gray-50 px-6 py-4">
          <div className="flex items-center text-sm text-gray-500">
            <Lock className="h-4 w-4 mr-2 flex-shrink-0" />
            <p>
              For security reasons, some features are limited while offline.
            </p>
          </div>
          
          <div className="flex items-center text-sm text-gray-500 mt-2">
            <Database className="h-4 w-4 mr-2 flex-shrink-0" />
            <p>
              Some of your recently accessed data may be available in offline mode.
            </p>
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-center text-sm text-gray-500">
        Need help? Contact support at support@secura-app.com
      </p>
    </div>
  );
}
