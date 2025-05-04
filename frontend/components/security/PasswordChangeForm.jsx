// frontend/components/security/PasswordChangeForm.jsx
"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '../../hooks/use-toast';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { UsersApi } from '../../lib/api-client';
import { useSecurityErrorHandler } from '../../lib/security-error-handler';

// Password validation schema
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(10, 'Password must be at least 10 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export function PasswordChangeForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormDisabled, setFormDisabled] = useState(false);
  const { toast } = useToast();
  
  // Initialize the security error handler
  const { handlePasswordChangeError } = useSecurityErrorHandler({ toast });
  
  // Initialize form with react-hook-form
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setError
  } = useForm({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  });
  
  // Handle form submission
  const onSubmit = async (data) => {
    try {
      setIsSubmitting(true);
      
      // Call the API to change the password
      const response = await UsersApi.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      });
      
      // Show success message
      toast({
        title: 'Password Changed',
        description: 'Your password has been successfully updated.',
        variant: 'default'
      });
      
      // Reset the form
      reset();
    } catch (error) {
      // Use our specialized error handler for password changes
      await handlePasswordChangeError(error, {
        setError,
        setFormDisabled
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="space-y-6 p-6 bg-white rounded-lg shadow-md">
      <div>
        <h3 className="text-lg font-medium">Change Password</h3>
        <p className="text-sm text-gray-500">
          Update your password to keep your account secure
        </p>
      </div>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="currentPassword" className="text-sm font-medium">
            Current Password
          </label>
          <Input
            id="currentPassword"
            type="password"
            disabled={isSubmitting || isFormDisabled}
            {...register('currentPassword')}
          />
          {errors.currentPassword && (
            <p className="text-sm text-red-500">{errors.currentPassword.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <label htmlFor="newPassword" className="text-sm font-medium">
            New Password
          </label>
          <Input
            id="newPassword"
            type="password"
            disabled={isSubmitting || isFormDisabled}
            {...register('newPassword')}
          />
          {errors.newPassword && (
            <p className="text-sm text-red-500">{errors.newPassword.message}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm New Password
          </label>
          <Input
            id="confirmPassword"
            type="password"
            disabled={isSubmitting || isFormDisabled}
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
          )}
        </div>
        
        <div className="pt-4">
          <Button
            type="submit"
            disabled={isSubmitting || isFormDisabled}
            className="w-full"
          >
            {isSubmitting ? 'Changing Password...' : 'Change Password'}
          </Button>
        </div>
        
        {errors.root && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{errors.root.message}</p>
          </div>
        )}
      </form>
      
      <div className="text-xs text-gray-500 mt-6">
        <p>Password requirements:</p>
        <ul className="list-disc list-inside mt-1">
          <li>At least 10 characters long</li>
          <li>Include uppercase and lowercase letters</li>
          <li>Include at least one number</li>
          <li>Include at least one special character</li>
        </ul>
      </div>
    </div>
  );
}
