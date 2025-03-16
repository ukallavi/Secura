// frontend/lib/auth.js
import { useRouter } from 'next/navigation';
import { ENDPOINTS, fetchWithCSRF } from './api-config';
import { useToast } from '@/hooks/use-toast';

// Authentication context to be used with React Context API
export const useAuth = () => {
  const router = useRouter();
  const { toast } = useToast();

  const login = async (credentials) => {
    try {
      const response = await fetchWithCSRF(ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
        credentials: 'include', // Important for cookies
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }

      const data = await response.json();
      
      // Check if 2FA is required
      if (data.requireTwoFactor) {
        return {
          requireTwoFactor: true,
          userId: data.userId
        };
      }
      
      // No localStorage, cookie is set by the server
      router.push('/main/passwords');
      return { success: true };
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message || "Please check your credentials and try again.",
      });
      return { error: error.message };
    }
  };

  const logout = async () => {
    try {
      await fetchWithCSRF(ENDPOINTS.LOGOUT, {
        method: 'POST',
        credentials: 'include',
      });
      
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      router.push('/login');
    }
  };

  const checkAuth = async () => {
    try {
      const response = await fetch(ENDPOINTS.PROFILE, {
        credentials: 'include',
      });
      
      return response.ok;
    } catch (error) {
      return false;
    }
  };

  return { login, logout, checkAuth };
};