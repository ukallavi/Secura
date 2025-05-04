'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function TestPage() {
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const testBackendConnection = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Testing connection to backend...');
      // Try multiple endpoints to diagnose the issue
      const endpoints = [
        'http://localhost:5000/api/healthcheck',
        'http://localhost:5000/api/test',
        'http://localhost:5000/',
        'http://localhost:5000/api/csrf-token'
      ];
      
      const results = [];
      
      for (const url of endpoints) {
        try {
          console.log(`Testing endpoint: ${url}`);
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            },
            mode: 'cors',
            credentials: 'include',
            cache: 'no-cache' // Prevent caching
          });
          
          console.log(`Response for ${url}:`, response);
          
          if (response.ok) {
            const data = await response.json();
            console.log(`Data for ${url}:`, data);
            results.push({ url, status: response.status, data });
          } else {
            const errorText = await response.text();
            console.error(`Error for ${url}:`, errorText);
            results.push({ url, status: response.status, error: errorText || 'Unknown error' });
          }
        } catch (endpointError) {
          console.error(`Exception for ${url}:`, endpointError);
          results.push({ url, status: 'error', error: endpointError.message });
        }
      }
      
      // Set the test result to the first successful response, or the last result
      const successResult = results.find(r => r.data);
      if (successResult) {
        setTestResult({ ...successResult.data, testedEndpoints: results });
      } else if (results.length > 0) {
        setError(`All endpoints failed. First error: ${results[0].error}`);
        setTestResult({ testedEndpoints: results });
      } else {
        setError('No endpoints were tested successfully');
      }
    } catch (err) {
      console.error('Backend test exception:', err);
      setError(`Connection error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Test connection when page loads
    testBackendConnection();
  }, []);

  return (
    <div className="flex justify-center items-center min-h-screen bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Backend Connectivity Test</CardTitle>
          <CardDescription>
            Testing connection to the backend server
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {testResult && (
            <div className="p-4 border rounded-md bg-green-50">
              <p className="font-medium text-green-700">Connection Test Results</p>
              {testResult.message && (
                <div className="mt-2">
                  <p className="text-sm">Message: {testResult.message}</p>
                  <p className="text-sm">Timestamp: {testResult.timestamp}</p>
                </div>
              )}
              
              {testResult.testedEndpoints && (
                <div className="mt-4">
                  <p className="font-medium">Endpoint Results:</p>
                  <div className="space-y-2 mt-2">
                    {testResult.testedEndpoints.map((result, index) => (
                      <div key={index} className={`p-2 border rounded-md ${result.data ? 'bg-green-100' : 'bg-red-100'}`}>
                        <p className="text-xs font-medium">{result.url}</p>
                        <p className="text-xs">Status: {result.status}</p>
                        {result.data && (
                          <p className="text-xs">Response: {JSON.stringify(result.data).substring(0, 100)}...</p>
                        )}
                        {result.error && (
                          <p className="text-xs text-red-600">Error: {result.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {loading && (
            <div className="flex justify-center p-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-4">
          <Button 
            onClick={testBackendConnection} 
            className="w-full" 
            disabled={loading}
          >
            {loading ? 'Testing...' : 'Test Connection Again'}
          </Button>
          
          <div className="text-center text-sm">
            <Link href="/" className="text-primary hover:underline">
              Back to Home
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
