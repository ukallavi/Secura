'use client';

import { useState, useEffect } from 'react';
import { ENDPOINTS, fetchWithCSRF, ErrorTypes } from '@/lib/api-config';
import { validatePasswordChangeForm } from '@/lib/validation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Image from 'next/image';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('account');
  const [loading, setLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [userData, setUserData] = useState(null);
  const { toast } = useToast();

  // Fetch user data including 2FA status
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch(ENDPOINTS.PROFILE, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }
        
        const data = await response.json();
        setUserData(data);
        setTwoFactorEnabled(data.twoFactorEnabled || false);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load user settings. Please try again.",
        });
      }
    };
    
    fetchUserData();
  }, [toast]);

  const togglePasswordVisibility = () => {
    setPasswordVisible(!passwordVisible);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    const validationErrors = validatePasswordChangeForm(passwordForm);
    setErrors(validationErrors);
    
    if (Object.keys(validationErrors).length > 0) {
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await fetchWithCSRF(`${ENDPOINTS.PROFILE}/password`, {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      
      if (response.ok) {
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        
        toast({
          title: "Password updated",
          description: "Your password has been updated successfully.",
        });
      }
    } catch (error) {
      let errorMessage = "Failed to update password. Please try again.";
      
      if (error.type === ErrorTypes.VALIDATION_ERROR) {
        errorMessage = error.message || "Please check your input and try again.";
      } else if (error.type === ErrorTypes.AUTH_ERROR) {
        errorMessage = "Current password is incorrect.";
      }
      
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm({
      ...passwordForm,
      [name]: value
    });
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  const handleTwoFactorToggle = async () => {
    if (twoFactorEnabled) {
      // Disable 2FA
      try {
        setLoading(true);
        const response = await fetchWithCSRF(`${ENDPOINTS.TWO_FACTOR}/disable`, {
          method: 'POST'
        });
        
        if (response.ok) {
          setTwoFactorEnabled(false);
          setShowQrCode(false);
          toast({
            title: "Two-factor authentication disabled",
            description: "Two-factor authentication has been disabled for your account.",
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to disable two-factor authentication. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    } else {
      // Enable 2FA - first step: get QR code
      try {
        setLoading(true);
        const response = await fetchWithCSRF(`${ENDPOINTS.TWO_FACTOR}/setup`, {
          method: 'POST'
        });
        
        if (response.ok) {
          const data = await response.json();
          setQrCodeUrl(data.qrCodeUrl);
          setShowQrCode(true);
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to set up two-factor authentication. Please try again.",
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const verifyTwoFactor = async () => {
    if (!verificationCode) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter the verification code from your authenticator app.",
      });
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetchWithCSRF(ENDPOINTS.VERIFY_TWO_FACTOR, {
        method: 'POST',
        body: JSON.stringify({ token: verificationCode })
      });
      
      if (response.ok) {
        setTwoFactorEnabled(true);
        setShowQrCode(false);
        setVerificationCode('');
        toast({
          title: "Two-factor authentication enabled",
          description: "Two-factor authentication has been enabled for your account.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Invalid verification code. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="account">Account Settings</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>
        
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Manage your account details and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  value={userData?.email || ''} 
                  disabled 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input 
                  id="name" 
                  value={userData?.name || ''} 
                  placeholder="Your name"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="email-notifications" 
                  checked={userData?.emailNotifications || false}
                />
                <Label htmlFor="email-notifications">Receive email notifications</Label>
              </div>
            </CardContent>
            <CardFooter>
              <Button>Save Changes</Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="security">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input 
                      id="current-password" 
                      name="currentPassword"
                      type={passwordVisible ? "text" : "password"} 
                      value={passwordForm.currentPassword}
                      onChange={handleInputChange}
                      className={errors.currentPassword ? "border-red-500" : ""}
                    />
                    <button 
                      type="button"
                      onClick={togglePasswordVisibility}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2"
                    >
                      {passwordVisible ? (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                  {errors.currentPassword && (
                    <p className="text-sm text-red-500">{errors.currentPassword}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input 
                      id="new-password" 
                      name="newPassword"
                      type={passwordVisible ? "text" : "password"} 
                      value={passwordForm.newPassword}
                      onChange={handleInputChange}
                      className={errors.newPassword ? "border-red-500" : ""}
                    />
                  </div>
                  {errors.newPassword && (
                    <p className="text-sm text-red-500">{errors.newPassword}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input 
                    id="confirm-password" 
                    name="confirmPassword"
                    type={passwordVisible ? "text" : "password"} 
                    value={passwordForm.confirmPassword}
                    onChange={handleInputChange}
                    className={errors.confirmPassword ? "border-red-500" : ""}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-500">{errors.confirmPassword}</p>
                  )}
                </div>
              </CardContent>
              <CardFooter>
              <Button onClick={handlePasswordChange} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="two-factor" 
                    checked={twoFactorEnabled} 
                    onCheckedChange={handleTwoFactorToggle}
                    disabled={loading || showQrCode}
                  />
                  <Label htmlFor="two-factor">
                    {twoFactorEnabled ? "Enabled" : "Disabled"}
                  </Label>
                </div>
                
                {showQrCode && (
                  <div className="space-y-4">
                    <Alert>
                      <AlertDescription>
                        Scan this QR code with your authenticator app (like Google Authenticator or Authy)
                      </AlertDescription>
                    </Alert>
                    
                    <div className="flex justify-center">
                      {qrCodeUrl && (
                        <div className="border p-4 rounded-md">
                          <Image 
                            src={qrCodeUrl} 
                            alt="QR Code for 2FA" 
                            width={200} 
                            height={200} 
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="verification-code">Verification Code</Label>
                      <Input 
                        id="verification-code" 
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        placeholder="Enter the 6-digit code"
                        maxLength={6}
                      />
                    </div>
                    
                    <Button onClick={verifyTwoFactor} disabled={loading} className="w-full">
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        "Verify and Enable"
                      )}
                    </Button>
                  </div>
                )}
                
                {twoFactorEnabled && !showQrCode && (
                  <Alert>
                    <AlertDescription>
                      Two-factor authentication is enabled. You'll need to enter a verification code when you sign in.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
        