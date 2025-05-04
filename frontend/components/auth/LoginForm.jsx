// frontend/components/auth/LoginForm.jsx
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '../../hooks/use-toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useAuthErrorHandler } from '../../lib/auth-error-handler';
import { useAuth } from '../../contexts/AuthContext';
import { deriveEncryptionKey } from '../../lib/encryption';
import crypto from 'crypto-js';
import { ENDPOINTS, fetchWithCSRF } from '../../lib/api-config';

// Login validation schema
const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export function LoginForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormDisabled, setFormDisabled] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  
  // Get redirect URL from query params if available
  const redirectUrl = searchParams.get('redirect') || '/main';
  const errorType = searchParams.get('error');
  
  // Initialize the auth error handler
  const { handleLoginError } = useAuthErrorHandler();
  
  // Initialize form with react-hook-form
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false
    }
  });
  
  // Handle error messages from URL parameters
  useEffect(() => {
    if (errorType) {
      switch (errorType) {
        case 'session_expired':
          toast({
            title: 'Session Expired',
            description: 'Your session has expired. Please log in again.',
            variant: 'default'
          });
          break;
        case 'security_auth_failure':
          toast({
            title: 'Security Alert',
            description: 'For your security, you have been logged out. Please log in again.',
            variant: 'destructive'
          });
          break;
        case 'account_locked':
          setError('root', { 
            message: 'Your account has been temporarily locked due to multiple failed login attempts. Please try again later or contact support.' 
          });
          setFormDisabled(true);
          break;
      }
    }
  }, [errorType, toast, setError]);
  
  // Handle form submission
  const onSubmit = async (data) => {
    try {
      setIsSubmitting(true);
      
      // First, fetch the user's auth salt and encryption salt
      const saltResponse = await fetchWithCSRF(`${ENDPOINTS.AUTH_SALT}?email=${encodeURIComponent(data.email)}`, {
        method: 'GET'
      });
      
      if (!saltResponse.ok) {
        throw new Error('Failed to retrieve authentication information');
      }
      
      const saltData = await saltResponse.json();
      const { authSalt, encryptionSalt } = saltData;
      
      if (!authSalt || !encryptionSalt) {
        throw new Error('Invalid authentication information');
      }
      
      // Hash the password with the auth salt for authentication
      // This is what will be sent to the server for authentication
      const hashedPassword = crypto.PBKDF2(
        data.password,
        authSalt,
        { keySize: 512/32, iterations: 10000 }
      ).toString();
      
      // Derive the encryption key from the master password and encryption salt
      // This key will be stored in memory only, never sent to the server
      const encryptionKey = await deriveEncryptionKey(data.password, encryptionSalt);
      
      // Store the encryption key in localStorage for later use
      localStorage.setItem('encryptionKey', encryptionKey);
      
      // Call the login function from AuthContext with the hashed password
      await login({
        email: data.email,
        password: hashedPassword,
        rememberMe: data.rememberMe
      });
      
      // Show success message
      toast({
        title: 'Login Successful',
        description: 'Welcome back to Secura!',
        variant: 'default'
      });
      
      // Redirect to the intended destination
      router.push(redirectUrl);
    } catch (error) {
      // Use our specialized error handler for login
      await handleLoginError(error, {
        setError,
        setFormDisabled,
        toast
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-md">
      <div>
        <h2 className="text-2xl font-bold text-center">Login to Secura</h2>
        <p className="text-sm text-gray-500 text-center mt-2">
          Your secure password manager
        </p>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            disabled={isSubmitting || isFormDisabled}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            disabled={isSubmitting || isFormDisabled}
            {...register('password')}
          />
          {errors.password && (
            <p className="text-sm text-red-500">{errors.password.message}</p>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="rememberMe"
            className="rounded border-gray-300"
            disabled={isSubmitting || isFormDisabled}
            {...register('rememberMe')}
          />
          <label htmlFor="rememberMe" className="text-sm text-gray-600">
            Remember me
          </label>
        </div>
        
        <div className="pt-2">
          <Button
            type="submit"
            disabled={isSubmitting || isFormDisabled}
            className="w-full"
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </Button>
        </div>
        
        {errors.root && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{errors.root.message}</p>
          </div>
        )}
      </form>
      
      <div className="text-center text-sm">
        <p>
          Don't have an account?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            Register
          </Link>
        </p>
      </div>
      
      <div className="text-xs text-gray-500 border-t pt-4 mt-4">
        <p className="text-center">
          Protected by Secura's advanced security monitoring
        </p>
      </div>
    </div>
  );
}
