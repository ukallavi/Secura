'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ENDPOINTS, fetchWithCSRF } from '@/lib/api-config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Shield, Key } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { validatePassword } from '@/lib/validation';

export default function AccountRecoveryPage({ params }) {
  const router = useRouter();
  const { toast } = useToast();
  const { token } = params;
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  
  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    
    verifyToken();
  }, [token, router]);
  
  const verifyToken = async () => {
    try {
      setLoading(true);
      const response = await fetchWithCSRF(`${ENDPOINTS.VERIFY_RECOVERY_TOKEN}/${token}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Invalid or expired token');
      }
      
      const data = await response.json();
      if (data.valid) {
        setTokenValid(true);
        setUserEmail(data.email);
      } else {
        throw new Error('Invalid recovery token');
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Invalid Recovery Link",
        description: error.message || "This recovery link is invalid or has expired. Please request a new one.",
      });
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };
  
  const validateForm = () => {
    // Reset errors
    setPasswordError('');
    
    // Validate recovery key
    if (!recoveryKey.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter your recovery key",
      });
      return false;
    }
    
    // Validate password
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.error);
      return false;
    }
    
    // Check if passwords match
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match");
      return false;
    }
    
    return true;
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setSubmitting(true);
      const response = await fetchWithCSRF(`${ENDPOINTS.COMPLETE_RECOVERY}/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recoveryKey,
          newPassword
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to recover account');
      }
      
      toast({
        title: "Account Recovered",
        description: "Your account has been recovered successfully. You can now log in with your new password.",
      });
      
      // Redirect to login page
      router.push('/login');
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Recovery Failed",
        description: error.message || "Failed to recover your account. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return (
      <div className="container max-w-md mx-auto mt-16 px-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Verifying Recovery Link</CardTitle>
            <CardDescription>Please wait while we verify your recovery link...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container max-w-md mx-auto mt-16 px-4">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 bg-primary/10 p-2 rounded-full w-12 h-12 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Account Recovery</CardTitle>
          <CardDescription>
            Enter your recovery key and set a new password to recover your account
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {userEmail && (
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">Recovering account for</p>
                <p className="font-medium">{userEmail}</p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="recoveryKey">Recovery Key</Label>
              <div className="relative">
                <div className="absolute left-3 top-3 text-gray-400">
                  <Key className="h-4 w-4" />
                </div>
                <Input
                  id="recoveryKey"
                  value={recoveryKey}
                  onChange={(e) => setRecoveryKey(e.target.value)}
                  className="pl-10"
                  placeholder="Enter your recovery key"
                  autoComplete="off"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the recovery key that was generated when you set up account recovery
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Create a new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
              />
            </div>
            
            {passwordError && (
              <Alert variant="destructive">
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full"
              disabled={submitting}
            >
              {submitting ? 'Recovering Account...' : 'Recover Account'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}