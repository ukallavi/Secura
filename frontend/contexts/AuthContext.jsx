// frontend/contexts/AuthContext.jsx
'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ENDPOINTS } from '@/lib/api-config';
import { useToast } from '@/components/ui/use-toast';
import logger from '@/lib/logger';
import { fetchWithCSRF } from '@/lib/api-client';

// Error types
const ErrorTypes = {
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED'
};

// Create context
const AuthContext = createContext({});

// Auth provider component
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user is logged in
    const checkAuth = async () => {
      try {
        console.log('Checking authentication status...');
        const data = await fetchWithCSRF(ENDPOINTS.PROFILE);
        console.log('Profile data received:', data);
        
        if (data.success && data.user) {
          // Ensure the role property exists and is properly set
          const userWithRole = {
            ...data.user,
            // If role is missing or undefined, default to 'user'
            role: data.user.role || 'user'
          };
          
          console.log('Setting user with validated role:', userWithRole);
          setUser(userWithRole);
          
          // Log the role for debugging
          console.log('User role:', userWithRole.role);
          
          // Store the role in sessionStorage for debugging purposes
          // This helps us verify what role is being set
          sessionStorage.setItem('userRole', userWithRole.role);
        } else {
          console.log('Profile request successful but invalid user data');
          setUser(null);
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        // Handle verification required case
        if (error.type === ErrorTypes.VERIFICATION_REQUIRED) {
          router.push('/verification');
        }
        // Other errors just mean user is not authenticated
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // Login function
  const login = async (credentials) => {
    try {
      setLoading(true);
      const data = await fetchWithCSRF(ENDPOINTS.LOGIN, {
        method: 'POST',
        body: JSON.stringify(credentials),
      });

      console.log('Login response:', data);

      // The backend returns a 200 status with a message field
      if (data.message === 'Login successful' && data.user) {
        // Ensure the role property exists and is properly set
        const userWithRole = {
          ...data.user,
          // If role is missing or undefined, default to 'user'
          role: data.user.role || 'user'
        };
        
        console.log('Setting user after login with role:', userWithRole.role);
        setUser(userWithRole);
        
        // Store the role in sessionStorage for debugging purposes
        sessionStorage.setItem('userRole', userWithRole.role);
        
        // Check if additional verification is required
        if (data.requireTwoFactor || data.requiresVerification) {
          // Store verification requirements if provided
          if (data.verificationRequirements) {
            sessionStorage.setItem('verificationRequirements', JSON.stringify(data.verificationRequirements));
          }
          router.push('/verification');
          return { success: true, requiresVerification: true };
        }
        
        // Successful login, redirect to main page
        router.push('/main/passwords');
        return { success: true };
      }
      
      return { success: false, message: data.message || 'Login failed' };
    } catch (error) {
      console.error('Login error:', error);
      // Handle verification required case
      if (error.type === ErrorTypes.VERIFICATION_REQUIRED) {
        router.push('/verification');
        return { success: true, requiresVerification: true };
      }
      
      return { 
        success: false, 
        message: error.message || 'An error occurred during login' 
      };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      setLoading(true);
      await fetchWithCSRF(ENDPOINTS.LOGOUT, {
        method: 'POST',
      });
      setUser(null);
      router.push('/login');
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error.message || 'An error occurred during logout' 
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setLoading(true);
      const data = await fetchWithCSRF(ENDPOINTS.REGISTER, {
        method: 'POST',
        body: JSON.stringify(userData),
      });

      if (data.success) {
        router.push('/login');
        return { success: true };
      }
      
      return { success: false, message: data.message };
    } catch (error) {
      return { 
        success: false, 
        message: error.message || 'An error occurred during registration' 
      };
    } finally {
      setLoading(false);
    }
  };
    
  // Verify two-factor authentication
  const verifyTwoFactor = async (userId, token) => {
    try {
      setLoading(true);
      const response = await fetch(`${ENDPOINTS.TWO_FACTOR}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, token }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Verification failed');
      }
      
      // Get user profile after successful 2FA
      const profileResponse = await fetch(ENDPOINTS.PROFILE, {
        credentials: 'include'
      });
      
      if (profileResponse.ok) {
        const userData = await profileResponse.json();
        setUser(userData);
        router.push('/main/passwords');
        return { success: true };
      } else {
        throw new Error('Failed to get user profile');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Verification failed",
        description: error.message || "Invalid verification code. Please try again.",
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
        register,
        verifyTwoFactor,
        setUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => useContext(AuthContext);

export default AuthContext;
