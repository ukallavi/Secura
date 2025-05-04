'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/lib/auth';
import { fetchWithCSRF } from '@/lib/api-client';
import { ENDPOINTS } from '@/lib/api-config';
import { Loader2, AlertCircle, Users, Shield, Clock, Lock, AlertTriangle, Share2 } from 'lucide-react';

// No static data - we'll only show real data from the API

export default function DashboardPage() {
  const { user: authUser } = useAuth();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [userActivity, setUserActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [activityError, setActivityError] = useState(null);
  
  // Initialize dashboard on mount
  useEffect(() => {
    // Skip user role checks for now and just load the dashboard
    console.log('Dashboard mounted, fetching data directly');
    fetchDashboardData();
  }, []);
  
  // We're skipping admin role checks for now to debug the dashboard
  
  const fetchDashboardData = async () => {
    try {
      // Reset errors
      setError(null);
      setStatsError(null);
      setActivityError(null);
      setLoading(true);
      
      console.log('Fetching real data from backend...');
      console.log('Stats endpoint:', ENDPOINTS.ADMIN_STATS);
      
      // Fetch stats data
      try {
        const statsResponse = await fetchWithCSRF(ENDPOINTS.ADMIN_STATS);
        console.log('Stats response:', statsResponse);
        
        if (statsResponse && !statsResponse.error) {
          setStats(statsResponse);
        } else {
          setStatsError('Failed to retrieve valid statistics data');
          setStats(null);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
        setStatsError('Failed to connect to statistics API');
        setStats(null);
      }
      
      // Fetch activity data
      try {
        const activityResponse = await fetchWithCSRF(ENDPOINTS.ADMIN_ACTIVITY);
        console.log('Activity response:', activityResponse);
        
        if (activityResponse && !activityResponse.error && 
            activityResponse.activities && activityResponse.activities.length > 0) {
          // Filter out VIEW_PROFILE events to reduce noise
          const filteredActivities = activityResponse.activities.filter(
            activity => activity.action !== 'VIEW_PROFILE'
          );
          
          console.log('Filtered out VIEW_PROFILE events:', 
            activityResponse.activities.length - filteredActivities.length);
          
          // Limit to the most recent 10 events
          const recentActivities = filteredActivities.slice(0, 10);
          
          setUserActivity(recentActivities);
        } else {
          setActivityError('Failed to retrieve user activity data');
          setUserActivity([]);
        }
      } catch (error) {
        console.error('Error fetching activity:', error);
        setActivityError('Failed to connect to activity API');
        setUserActivity([]);
      }
    } catch (error) {
      console.error('Error in fetchDashboardData:', error);
      setError('Failed to load dashboard data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // If we know the user is not an admin, return null (will be redirected to 404)
  if (user && user.role !== 'admin') {
    return null;
  }
  
  // If loading for more than 5 seconds, show a timeout message
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        if (loading) {
          console.log('Loading timeout reached');
          setLoading(false);
          setError('Dashboard data loading timed out. Please refresh the page.');
        }
      }, 5000); // 5 second timeout
      
      return () => clearTimeout(timer);
    }
  }, [loading]);
  
  // If loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      
      {/* Stats Overview */}
      {statsError ? (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Statistics Error</AlertTitle>
          <AlertDescription>{statsError}</AlertDescription>
        </Alert>
      ) : null}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <>
                <div className="text-2xl font-bold">{stats.totalUsers || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.activeUsers || 0} active in last 24h
                </p>
              </>
            ) : (
              <div className="text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Passwords</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Shield className="h-5 w-5 mr-2 text-primary" />
              <div className="text-3xl font-bold">{stats?.totalPasswords || 0}</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Weak Passwords</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-amber-500" />
              <div className="text-3xl font-bold">{stats?.weakPasswords || 0}</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Security Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
              <div className="text-3xl font-bold">{stats?.securityAlerts || 0}</div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* User Activity */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Recent User Activity</h2>
        {activityError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Activity Error</AlertTitle>
            <AlertDescription>{activityError}</AlertDescription>
          </Alert>
        ) : (
          <div className="rounded-md border">
            <div className="grid grid-cols-5 p-4 font-medium border-b">
              <div>User</div>
              <div>Action</div>
              <div>Time</div>
              <div>IP Address</div>
              <div>Status</div>
            </div>
            
            <div className="max-h-80 overflow-y-auto">
              {userActivity.length > 0 ? (
                userActivity.map((activity) => (
                  <div key={activity.id} className="grid grid-cols-5 p-4 border-b last:border-0 items-center">
                    <div className="font-medium">{activity.userId}</div>
                    <div>{activity.action.replace(/_/g, ' ')}</div>
                    <div>{new Date(activity.timestamp).toLocaleString()}</div>
                    <div>{activity.ipAddress}</div>
                    <div>
                      <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-green-50 text-green-700">
                        Success
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  No recent activity found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Security Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Password Security Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Weak Passwords</span>
                <span className="font-medium">{stats?.weakPasswords || 0} / {stats?.totalPasswords || 0}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div 
                  className="bg-amber-500 h-2.5 rounded-full" 
                  style={{ width: `${stats?.totalPasswords ? (stats.weakPasswords / stats.totalPasswords) * 100 : 0}%` }}
                ></div>
              </div>
              
              <div className="flex justify-between items-center">
                <span>Reused Passwords</span>
                <span className="font-medium">{stats?.reusedPasswords || 0} / {stats?.totalPasswords || 0}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div 
                  className="bg-orange-500 h-2.5 rounded-full" 
                  style={{ width: `${stats?.totalPasswords ? (stats.reusedPasswords / stats.totalPasswords) * 100 : 0}%` }}
                ></div>
              </div>
              
              <div className="flex justify-between items-center">
                <span>Shared Passwords</span>
                <span className="font-medium">{stats?.sharedPasswords || 0} / {stats?.totalPasswords || 0}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div 
                  className="bg-blue-500 h-2.5 rounded-full" 
                  style={{ width: `${stats?.totalPasswords ? (stats.sharedPasswords / stats.totalPasswords) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>User Activity Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Active Users (Last 24h)</span>
                <span className="font-medium">{stats?.activeUsers || 0} / {stats?.totalUsers || 0}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div 
                  className="bg-green-500 h-2.5 rounded-full" 
                  style={{ width: `${stats?.totalUsers ? (stats.activeUsers / stats.totalUsers) * 100 : 0}%` }}
                ></div>
              </div>
              
              <div className="mt-6">
                <h3 className="text-sm font-medium mb-2">Activity Breakdown</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Login Events</span>
                    <span className="text-sm font-medium">{userActivity.filter(a => a.action === 'LOGIN').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Password Updates</span>
                    <span className="text-sm font-medium">{userActivity.filter(a => a.action === 'PASSWORD_UPDATE').length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Failed Logins</span>
                    <span className="text-sm font-medium">{userActivity.filter(a => a.action === 'FAILED_LOGIN').length}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
