"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/error-message';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Download, 
  Filter, 
  PieChart, 
  RefreshCw, 
  Search, 
  UserX 
} from 'lucide-react';
import { useErrorHandling } from '@/contexts/ErrorHandlingContext';
import { useAuth } from '@/contexts/AuthContext';
import { AdminApi } from '@/lib/api-client';

export default function ErrorMonitoringPage() {
  const [loading, setLoading] = useState(true);
  const [errorStats, setErrorStats] = useState(null);
  const [errorLogs, setErrorLogs] = useState([]);
  const [timeRange, setTimeRange] = useState('24h');
  const [filter, setFilter] = useState('all');
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
  
  // Fetch error stats on mount and when timeRange changes
  useEffect(() => {
    fetchErrorStats();
  }, [timeRange]);
  
  // Fetch error stats from the API
  const fetchErrorStats = async () => {
    setLoading(true);
    try {
      const data = await AdminApi.getErrorStats(timeRange);
      setErrorStats(data.stats);
      setErrorLogs(data.recentErrors || []);
    } catch (error) {
      handleError(error, {
        title: 'Error Loading Data',
        context: { page: 'error-monitoring', action: 'fetch-stats' }
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handle resolving an error
  const handleResolveError = async (errorId) => {
    try {
      await AdminApi.resolveError(errorId);
      
      // Update the error in the list
      setErrorLogs(logs => 
        logs.map(log => 
          log.id === errorId ? { ...log, is_resolved: true } : log
        )
      );
      
      toast({
        title: 'Error Resolved',
        description: 'The error has been marked as resolved',
        variant: 'default',
      });
    } catch (error) {
      handleError(error, {
        title: 'Failed to Resolve Error',
        context: { page: 'error-monitoring', action: 'resolve-error', errorId }
      });
    }
  };
  
  // Format date for display
  const formatDate = (dateString) => {
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
  
  // Get filtered errors
  const getFilteredErrors = () => {
    if (filter === 'all') return errorLogs;
    if (filter === 'resolved') return errorLogs.filter(log => log.is_resolved);
    if (filter === 'unresolved') return errorLogs.filter(log => !log.is_resolved);
    return errorLogs;
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Error Monitoring Dashboard</h1>
        
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchErrorStats}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <select
            className="border rounded px-2 py-1 text-sm"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Error stats cards */}
          {errorStats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center">
                  <AlertCircle className="h-8 w-8 text-red-500 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Total Errors</p>
                    <p className="text-2xl font-bold">{errorStats.total_errors || 0}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center">
                  <UserX className="h-8 w-8 text-orange-500 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Affected Users</p>
                    <p className="text-2xl font-bold">{errorStats.affected_users || 0}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center">
                  <PieChart className="h-8 w-8 text-blue-500 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Affected Sessions</p>
                    <p className="text-2xl font-bold">{errorStats.affected_sessions || 0}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-purple-500 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Most Recent</p>
                    <p className="text-sm font-medium">
                      {errorStats.most_recent_error ? 
                        new Date(errorStats.most_recent_error).toLocaleTimeString() : 
                        'None'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Error logs table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-medium">Error Logs</h2>
              
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search errors..."
                    className="pl-8 pr-4 py-1 border rounded text-sm w-64"
                  />
                </div>
                
                <select
                  className="border rounded px-2 py-1 text-sm"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All Errors</option>
                  <option value="unresolved">Unresolved</option>
                  <option value="resolved">Resolved</option>
                </select>
                
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
            
            {errorLogs.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500">No errors found in this time period.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getFilteredErrors().map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(log.timestamp)}
                        </TableCell>
                        <TableCell>{getErrorTypeBadge(log.error_type)}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {log.error_message}
                        </TableCell>
                        <TableCell>
                          {log.user_id ? log.user_id : 'Anonymous'}
                        </TableCell>
                        <TableCell>
                          {log.is_resolved ? (
                            <span className="inline-flex items-center text-green-600">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Resolved
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-red-600">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Unresolved
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => router.push(`/admin/error-monitoring/${log.id}`)}
                            >
                              View
                            </Button>
                            
                            {!log.is_resolved && (
                              <Button 
                                size="sm" 
                                variant="default"
                                onClick={() => handleResolveError(log.id)}
                              >
                                Resolve
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          
          {/* Error types breakdown */}
          {errorStats && errorStats.topErrorTypes && (
            <div className="mt-6 bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-medium mb-4">Top Error Types</h2>
              <div className="space-y-2">
                {errorStats.topErrorTypes.map((item, index) => (
                  <div key={index} className="flex items-center">
                    <div className="w-32">
                      {getErrorTypeBadge(item.error_type)}
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(item.count / errorStats.total_errors) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="w-16 text-right text-sm">
                      {item.count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
