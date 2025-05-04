'use client';

import { useState } from 'react';
import { validateEmail, validatePassword, validatePasswordStrength } from '@/lib/validation';
import { ENDPOINTS, fetchWithCSRF } from '@/lib/api-config';
import { deriveEncryptionKey } from '@/lib/encryption';
import crypto from 'crypto-js';
import { RecoveryOptions } from '@/components/auth/recovery-options';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BackupCodesDisplay } from '@/components/auth/backup-codes-display';

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [recoveryOptions, setRecoveryOptions] = useState({
    useBackupCodes: true,
    useEmailRecovery: false,
    recoveryEmail: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    
    // Update password strength
    if (name === 'password') {
      setPasswordStrength(validatePasswordStrength(value));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!validatePassword(formData.password)) {
      newErrors.password = 'Password must be at least 8 characters with uppercase, lowercase, and numbers';
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (!recoveryOptions.useBackupCodes && !recoveryOptions.useEmailRecovery) {
      newErrors.form = 'At least one recovery option must be selected';
    }
    
    if (recoveryOptions.useEmailRecovery && !recoveryOptions.recoveryEmail) {
      newErrors.form = 'Recovery email is required when email recovery is selected';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Generate a random encryption salt for the user
      const encryptionSalt = crypto.lib.WordArray.random(32).toString();
      
      // Derive the encryption key from the master password and salt
      // This key will be stored in memory only, never sent to the server
      const encryptionKey = await deriveEncryptionKey(formData.password, encryptionSalt);
      
      // Hash the password with a different salt for authentication
      // This is what will be sent to the server for authentication purposes
      const authSalt = crypto.lib.WordArray.random(16).toString();
      const hashedPassword = crypto.PBKDF2(
        formData.password,
        authSalt,
        { keySize: 512/32, iterations: 10000 }
      ).toString(crypto.enc.Hex); // Explicitly convert to hex string for consistency with login
      
      // Use fetchWithCSRF for secure API calls with CSRF protection
      // Note: fetchWithCSRF already parses the JSON response and returns the data
      const responseData = await fetchWithCSRF(ENDPOINTS.REGISTER, {
        method: 'POST',
        body: JSON.stringify({
          email: formData.email,
          password: hashedPassword,
          authSalt: authSalt,
          encryptionSalt: encryptionSalt, // Send the encryption salt to be stored
          recoveryOptions: {
            useBackupCodes: recoveryOptions.useBackupCodes,
            useEmailRecovery: recoveryOptions.useEmailRecovery,
            recoveryEmail: recoveryOptions.recoveryEmail
          }
        })
      });
      
      // Store the encryption key in localStorage for later use
      localStorage.setItem('encryptionKey', encryptionKey);
      
      // If we have backup codes in the response, store them and show them to the user
      if (responseData.backupCodes && responseData.backupCodes.length > 0) {
        setBackupCodes(responseData.backupCodes);
      }
      
      // Registration successful
      toast({
        title: "Account created successfully",
        description: recoveryOptions.useBackupCodes ? "Save your backup codes before continuing" : "You can now log in with your credentials",
        variant: "success"
      });
      
      // Set registration complete to show backup codes or redirect
      setRegistrationComplete(true);
      
      // If no backup codes were selected, redirect to login
      if (!recoveryOptions.useBackupCodes) {
        router.push('/login');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setErrors(prev => ({ ...prev, form: error.message }));
      
      toast({
        title: "Registration failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle continue after showing backup codes
  const handleContinueToLogin = () => {
    router.push('/login');
  };

  // Render password strength indicator
  const renderPasswordStrengthIndicator = () => {
    if (!passwordStrength || !formData.password) return null;
    
    const strengthClasses = {
      weak: "bg-red-500",
      medium: "bg-yellow-500",
      strong: "bg-green-500",
      veryStrong: "bg-green-700"
    };
    
    const strengthLabels = {
      weak: "Weak",
      medium: "Medium",
      strong: "Strong",
      veryStrong: "Very Strong"
    };
    
    return (
      <div className="mt-2">
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full ${strengthClasses[passwordStrength]}`} 
              style={{ width: passwordStrength === 'weak' ? '25%' : 
                      passwordStrength === 'medium' ? '50%' : 
                      passwordStrength === 'strong' ? '75%' : '100%' }}
            />
          </div>
          <span className="text-xs">{strengthLabels[passwordStrength]}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50">
      {registrationComplete && recoveryOptions.useBackupCodes && backupCodes.length > 0 ? (
        <BackupCodesDisplay backupCodes={backupCodes} onContinue={handleContinueToLogin} />
      ) : (
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
            <CardDescription>
              Enter your details to create your account
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {errors.form && (
                <Alert variant="destructive">
                  <AlertDescription>{errors.form}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className={errors.email ? "border-red-500" : ""}
                  aria-invalid={errors.email ? "true" : "false"}
                />
                {errors.email && (
                  <p className="text-sm text-red-500 mt-1">{errors.email}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    className={errors.password ? "border-red-500 pr-10" : "pr-10"}
                    aria-invalid={errors.password ? "true" : "false"}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    <span className="sr-only">
                      {showPassword ? "Hide password" : "Show password"}
                    </span>
                  </Button>
                </div>
                {renderPasswordStrengthIndicator()}
                {errors.password ? (
                  <p className="text-sm text-red-500 mt-1">{errors.password}</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">
                    Password must be at least 8 characters with uppercase, lowercase, and numbers
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={errors.confirmPassword ? "border-red-500" : ""}
                    aria-invalid={errors.confirmPassword ? "true" : "false"}
                  />
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-red-500 mt-1">{errors.confirmPassword}</p>
                )}
              </div>
              
              <RecoveryOptions 
                onRecoveryOptionsChange={setRecoveryOptions} 
                initialOptions={recoveryOptions}
                initialEmail={recoveryOptions.recoveryEmail}
              />
            </CardContent>
            <CardFooter>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
            </CardFooter>
          </form>
          <CardFooter className="flex justify-center border-t px-6 py-4">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
