'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  AlertTriangle, 
  Users, 
  Activity, 
  BarChart,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Check if user is admin
  useEffect(() => {
    setLoading(true);
    // Check if user is loaded and has admin role
    if (user) {
      if (user.role !== 'admin') {
        toast({
          title: 'Access Denied',
          description: 'You do not have permission to view this page',
          variant: 'destructive',
        });
        router.push('/main');
      }
      setLoading(false);
    }
  }, [user, router, toast]);

  // Get the current active tab based on the pathname
  const getActiveTab = () => {
    if (pathname.includes('/admin/dashboard')) return 'dashboard';
    if (pathname.includes('/admin/user-monitoring')) return 'user-monitoring';
    if (pathname.includes('/admin/error-monitoring')) return 'error-monitoring';
    if (pathname.includes('/admin/error-analytics')) return 'error-analytics';
    if (pathname.includes('/admin/suspicious-activities')) return 'suspicious-activities';
    // Default to dashboard
    return 'dashboard';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            onClick={() => router.push('/main')}
            className="mr-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Main
          </Button>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        </div>
      </div>

      <Tabs defaultValue={getActiveTab()} className="w-full" value={getActiveTab()}>
        <TabsList className="grid grid-cols-5 mb-4">
          <TabsTrigger value="dashboard" asChild>
            <Link href="/admin/dashboard" className="flex items-center justify-center">
              <BarChart className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </TabsTrigger>
          <TabsTrigger value="user-monitoring" asChild>
            <Link href="/admin/user-monitoring" className="flex items-center justify-center">
              <Users className="h-4 w-4 mr-2" />
              User Monitoring
            </Link>
          </TabsTrigger>
          <TabsTrigger value="error-monitoring" asChild>
            <Link href="/admin/error-monitoring" className="flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Error Monitoring
            </Link>
          </TabsTrigger>
          <TabsTrigger value="error-analytics" asChild>
            <Link href="/admin/error-analytics" className="flex items-center justify-center">
              <BarChart className="h-4 w-4 mr-2" />
              Error Analytics
            </Link>
          </TabsTrigger>
          <TabsTrigger value="suspicious-activities" asChild>
            <Link href="/admin/suspicious-activities" className="flex items-center justify-center">
              <Activity className="h-4 w-4 mr-2" />
              Suspicious Activities
            </Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-6">
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
