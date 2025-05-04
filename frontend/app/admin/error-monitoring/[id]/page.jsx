"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlertCircle, 
  ArrowLeft, 
  CheckCircle, 
  ExternalLink, 
  FileCode, 
  RefreshCw, 
  Trash2, 
  UserX, 
  AlertTriangle,
  Calendar,
  Code
} from 'lucide-react';
import { useErrorHandling } from '@/contexts/ErrorHandlingContext';
import { useAuth } from '@/contexts/AuthContext';
import { AdminApi } from '@/lib/api-client';

export default function ErrorDetailsPage({ params }) {
  const { id } = params;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [relatedErrors, setRelatedErrors] = useState([]);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const { toast } = useToast();
  const router = useRouter();
  const { handleError } = useErrorHandling();
  const { user } = useAuth();
  
  // Check if user is admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to view this page',
        variant: 'destructive',
      });
      router.push('/main');
    }
  }, [user, router, toast]);
  
  // Fetch error details on mount
  useEffect(() => {
    fetchErrorDetails();
  }, [id]);
  
  // Fetch error details from the API
  const fetchErrorDetails = async () => {
    setLoading(true);
    try {
      const data = await AdminApi.getErrorDetails(id);
      setError(data.error);
      setRelatedErrors(data.relatedErrors || []);
    } catch (error) {
      handleError(error, {
        title: 'Error Loading Details',
        context: { page: 'error-details', action: 'fetch-details', errorId: id }
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle resolving an error
  const handleResolveError = async () => {
    try {
      await AdminApi.resolveError(id, resolutionNotes);
      
      // Update local state
      setError({
        ...error,
        is_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
        resolution_notes: resolutionNotes
      });
      
      toast({
        title: 'Error Resolved',
        description: 'The error has been marked as resolved',
        variant: 'default',
      });
    } catch (error) {
      handleError(error, {
        title: 'Failed to Resolve Error',
        context: { page: 'error-details', action: 'resolve-error', errorId: id }
      });
    }
  };
  
  // Handle reopening an error
  const handleReopenError = async () => {
    try {
      await AdminApi.reopenError(id);
      
      // Update local state
      setError({
        ...error,
        is_resolved: false,
        resolved_at: null,
        resolved_by: null,
        resolution_notes: null
      });
      
      toast({
        title: 'Error Reopened',
        description: 'The error has been reopened',
        variant: 'default',
      });
    } catch (error) {
      handleError(error, {
        title: 'Failed to Reopen Error',
        context: { page: 'error-details', action: 'reopen-error', errorId: id }
      });
    }
  };
  
  // Handle deleting an error
  const handleDeleteError = async () => {
    if (!confirm('Are you sure you want to delete this error record? This action cannot be undone.')) {
      return;
    }
    
    try {
      await AdminApi.deleteError(id);
      
      toast({
        title: 'Error Deleted',
        description: 'The error record has been permanently deleted',
        variant: 'default',
      });
      
      // Navigate back to the error monitoring dashboard
      router.push('/admin/error-monitoring');
    } catch (error) {
      handleError(error, {
        title: 'Failed to Delete Error',
        context: { page: 'error-details', action: 'delete-error', errorId: id }
      });
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };
  
  // Get error type badge
  const getErrorTypeBadge = (type) => {
    const badges = {
      'AUTH_ERROR': <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">Auth</span>,
      'VALIDATION_ERROR': <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">Validation</span>,
      'SERVER_ERROR': <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">Server</span>,
      'NETWORK_ERROR': <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">Network</span>,
      'NOT_FOUND_ERROR': <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">Not Found</span>,
      'FORBIDDEN_ERROR': <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs">Forbidden</span>,
      'RATE_LIMIT_ERROR': <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs">Rate Limit</span>,
    };
    
    return badges[type] || <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">{type}</span>;
  };
  
  // Parse stack trace into a more readable format
  const parseStackTrace = (stackTrace) => {
    if (!stackTrace) return null;
    
    try {
      // Split by new lines
      const lines = stackTrace.split('\\n');
      
      return (
        <div className="text-xs font-mono">
          {lines.map((line, index) => (
            <div 
              key={index} 
              className={`py-1 ${index === 0 ? 'text-red-600 font-semibold' : ''}`}
            >
              {line}
            </div>
          ))}
        </div>
      );
    } catch (e) {
      return <div className="text-xs font-mono">{stackTrace}</div>;
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => router.push('/admin/error-monitoring')}
          className="mr-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        
        <h1 className="text-2xl font-bold">Error Details</h1>
        
        <div className="ml-auto">
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchErrorDetails}
            className="mr-2"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button 
            variant="destructive" 
            size="sm"
            onClick={handleDeleteError}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main error details */}
          <div className="lg:col-span-2">
            <Card className="mb-6">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center">
                      {error.is_resolved ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                      )}
                      {getErrorTypeBadge(error.error_type)}
                      <span className="ml-2">
                        {error.error_status ? `[${error.error_status}]` : ''}
                      </span>
                    </CardTitle>
                    <CardDescription>
                      Recorded at {formatDate(error.timestamp)}
                    </CardDescription>
                  </div>
                  
                  {error.is_resolved ? (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleReopenError}
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Reopen
                    </Button>
                  ) : (
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={handleResolveError}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Resolve
                    </Button>
                  )}
                </div>
              </CardHeader>
              
              <CardContent>
                <Tabs defaultValue="details">
                  <TabsList className="mb-4">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="stack">Stack Trace</TabsTrigger>
                    <TabsTrigger value="context">Context</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="details">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Error Message</h3>
                        <p className="text-sm font-semibold">{error.error_message}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1">User ID</h3>
                          <p className="text-sm">{error.user_id || 'Anonymous'}</p>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1">Session ID</h3>
                          <p className="font-mono text-xs">{error.session_id}</p>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1">URL</h3>
                          <p className="text-sm truncate">{error.url || 'N/A'}</p>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1">IP Address</h3>
                          <p className="text-sm">{error.ip_address || 'N/A'}</p>
                        </div>
                      </div>
                      
                      {error.user_agent && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1">User Agent</h3>
                          <p className="text-xs font-mono bg-gray-50 p-2 rounded">{error.user_agent}</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="stack">
                    {error.error_stack ? (
                      <div className="bg-gray-50 p-4 rounded-md overflow-x-auto">
                        {parseStackTrace(error.error_stack)}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No stack trace available</p>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="context">
                    {error.context ? (
                      <div className="bg-gray-50 p-4 rounded-md overflow-x-auto">
                        <pre className="text-xs">{JSON.stringify(error.context, null, 2)}</pre>
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No context data available</p>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            
            {/* Resolution Notes */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">
                  {error.is_resolved ? 'Resolution Notes' : 'Add Resolution Notes'}
                </CardTitle>
                {error.is_resolved && (
                  <CardDescription>
                    Resolved by {error.resolved_by || 'Unknown'} on {formatDate(error.resolved_at)}
                  </CardDescription>
                )}
              </CardHeader>
              
              <CardContent>
                {error.is_resolved ? (
                  <div className="bg-gray-50 p-4 rounded-md">
                    {error.resolution_notes || 'No notes provided'}
                  </div>
                ) : (
                  <Textarea 
                    placeholder="Enter notes about how this error was resolved..."
                    className="w-full"
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    rows={4}
                  />
                )}
              </CardContent>
              
              {!error.is_resolved && (
                <CardFooter>
                  <Button onClick={handleResolveError}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Resolved
                  </Button>
                </CardFooter>
              )}
            </Card>
          </div>
          
          {/* Sidebar */}
          <div>
            {/* Related Errors */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">Related Errors</CardTitle>
                <CardDescription>
                  {relatedErrors.length} other errors with the same type
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                {relatedErrors.length === 0 ? (
                  <p className="text-gray-500 italic">No related errors found</p>
                ) : (
                  <div className="space-y-3">
                    {relatedErrors.map((relatedError) => (
                      <div 
                        key={relatedError.id} 
                        className="flex justify-between items-center p-2 bg-gray-50 rounded-md text-sm hover:bg-gray-100 cursor-pointer"
                        onClick={() => router.push(`/admin/error-monitoring/${relatedError.id}`)}
                      >
                        <div className="flex items-center">
                          {relatedError.is_resolved ? (
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                          )}
                          <span className="truncate max-w-[150px]">
                            {relatedError.user_id || 'Anonymous'}
                          </span>
                        </div>
                        
                        <span className="text-xs text-gray-500">
                          {new Date(relatedError.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                    
                    {relatedErrors.length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full mt-2"
                        onClick={() => router.push({
                          pathname: '/admin/error-monitoring',
                          query: { error_type: error.error_type, error_message: error.error_message }
                        })}
                      >
                        View All Related
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Error Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Metadata</CardTitle>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 text-gray-500 mr-2" />
                    <div>
                      <p className="text-xs text-gray-500">Created</p>
                      <p className="text-sm">{formatDate(error.created_at)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center">
                    <Code className="h-4 w-4 text-gray-500 mr-2" />
                    <div>
                      <p className="text-xs text-gray-500">Error ID</p>
                      <p className="text-sm font-mono">{error.id}</p>
                    </div>
                  </div>
                  
                  {error.tags && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {error.tags.split(',').map((tag, index) => (
                          <span key={index} className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 p-8 text-center rounded-lg">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Error Not Found</h2>
          <p className="text-gray-600 mb-4">
            The error record you're looking for could not be found. It may have been deleted or never existed.
          </p>
          <Button 
            onClick={() => router.push('/admin/error-monitoring')}
            variant="outline"
          >
            Return to Dashboard
          </Button>
        </div>
      )}
    </div>
  );
}
