'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/loading';
import AccessDenied from '@/components/access-denied';

export default function AdminRoute({ children }) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    // If auth check is complete and user is not authenticated
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  // Show loading while checking auth status
  if (loading) {
    return <Loading />;
  }

  // If authenticated but not admin, show access denied
  if (isAuthenticated && !isAdmin) {
    return <AccessDenied />;
  }

  // If authenticated and admin, render children
  return isAuthenticated && isAdmin ? children : null;
}