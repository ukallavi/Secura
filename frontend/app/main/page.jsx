'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Key, Shield, Clock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/use-toast';
import { ENDPOINTS, fetchWithCSRF } from '@/lib/api-config';

export default function Dashboard() {
  const { toast } = useToast();
  const [stats, setStats] = useState({
    totalPasswords: 0,
    recentlyAdded: 0,
    weakPasswords: 0
  });
  const [recentPasswords, setRecentPasswords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch actual data from API
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Fetch password statistics
        const statsResponse = await fetchWithCSRF(ENDPOINTS.PASSWORD_STATS, {
          method: 'GET'
        });
        
        if (!statsResponse.ok) {
          throw new Error('Failed to fetch password statistics');
        }
        
        const statsData = await statsResponse.json();
        setStats({
          totalPasswords: statsData.totalCount || 0,
          recentlyAdded: statsData.recentlyAddedCount || 0,
          weakPasswords: statsData.weakPasswordsCount || 0
        });
        
        // Fetch recent passwords
        const recentResponse = await fetchWithCSRF(ENDPOINTS.RECENT_PASSWORDS, {
          method: 'GET'
        });
        
        if (!recentResponse.ok) {
          throw new Error('Failed to fetch recent passwords');
        }
        
        const recentData = await recentResponse.json();
        setRecentPasswords(recentData.passwords || []);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        // Show error toast
        toast({
          variant: "destructive",
          title: "Error loading data",
          description: error.message || "Failed to load dashboard data. Please try again."
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [toast]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Button asChild>
          <Link href="/dashboard/generator">Generate Password</Link>
        </Button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Passwords</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : stats.totalPasswords}
            </div>
            <p className="text-xs text-muted-foreground">
              Stored securely in your vault
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Recently Added</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : stats.recentlyAdded}
            </div>
            <p className="text-xs text-muted-foreground">
              Added in the last 30 days
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Weak Passwords</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : stats.weakPasswords}
            </div>
            <p className="text-xs text-muted-foreground">
              Passwords that need strengthening
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Recent Passwords */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Passwords</CardTitle>
          <CardDescription>
            Your recently added or updated passwords
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-6 text-muted-foreground">
              Loading recent passwords...
            </div>
          ) : recentPasswords.length > 0 ? (
            <div className="space-y-4">
              {recentPasswords.map(password => (
                <div 
                  key={password.id} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                      <Key className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{password.accountName}</p>
                      <p className="text-xs text-muted-foreground">
                        Updated {password.lastUpdated}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/dashboard/passwords/${password.id}`}>
                      View
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              No passwords added yet. Generate your first password!
            </div>
          )}
          
          <div className="mt-6">
            <Button variant="outline" className="w-full" asChild>
              <Link href="/dashboard/passwords">
                View All Passwords
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Security Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Security Tips</CardTitle>
          <CardDescription>
            Best practices for keeping your passwords secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex">
              <Shield className="h-5 w-5 mr-3 text-primary flex-shrink-0" />
              <span>Use unique passwords for each account to prevent credential stuffing attacks</span>
            </li>
            <li className="flex">
              <Shield className="h-5 w-5 mr-3 text-primary flex-shrink-0" />
              <span>Enable two-factor authentication whenever possible for additional security</span>
            </li>
            <li className="flex">
              <Shield className="h-5 w-5 mr-3 text-primary flex-shrink-0" />
              <span>Regularly update your passwords, especially for critical accounts</span>
            </li>
            <li className="flex">
              <Shield className="h-5 w-5 mr-3 text-primary flex-shrink-0" />
              <span>Avoid using personal information in your passwords</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}