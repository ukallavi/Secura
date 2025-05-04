'use client';

import { useState, useEffect } from 'react';
import { ENDPOINTS, ErrorTypes, fetchWithCSRF } from '@/lib/api-config';
import { validatePasswordChangeForm } from '@/lib/validation';
import { getEncryptionKey, deriveEncryptionKey, encryptData, decryptData } from '@/lib/encryption';
import crypto from 'crypto-js';
import { BackupCodesDialog } from '@/components/auth/backup-codes';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
// ToggleSwitch copied from security/page.jsx
const ToggleSwitch = ({ checked, onChange, id, disabled }) => (
  <div 
    className={`relative inline-flex h-6 w-11 items-center rounded-full bg-muted transition-colors cursor-pointer ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    onClick={disabled ? undefined : onChange}
    role="switch"
    aria-checked={checked}
    id={id}
    tabIndex={0}
    aria-disabled={disabled}
  >
    <span 
      className="inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform"
      style={{ transform: checked ? 'translateX(20px)' : 'translateX(2px)' }}
    />
  </div>
);

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
  const [qrCode, setQrCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [userData, setUserData] = useState(null);
  const { toast } = useToast();

  const tabButtons = [
    { key: 'account', label: 'Account Settings' },
    { key: 'security', label: 'Security' }
  ];

  // Define fetchUserData outside useEffect so it can be reused
  const fetchUserData = async () => {
    try {
      console.log('Fetching user profile data...');
      setLoading(true);
      
      // fetchWithCSRF already returns the parsed JSON data, not a Response object
      const data = await fetchWithCSRF(ENDPOINTS.PROFILE, {
        method: 'GET'
      });
      
      console.log('User profile data received:', data);
      
      // Check if data exists and has user property
      if (!data || !data.user) {
        throw new Error('Invalid user data received');
      }
      
      setUserData(data.user);
      setTwoFactorEnabled(data.user.twoFactorEnabled || false);
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load user settings. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch user data including 2FA status on component mount
  useEffect(() => {
    fetchUserData();
  }, []);

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
      // 1. Get the current encryption key
      const currentEncryptionKey = getEncryptionKey();
      if (!currentEncryptionKey) {
        throw new Error('Current encryption key not found. Please log in again.');
      }
      
      // 2. Fetch all passwords to re-encrypt them
      const passwordsResponse = await fetchWithCSRF(`${ENDPOINTS.PASSWORDS}?limit=1000`, {
        method: 'GET'
      });
      
      if (!passwordsResponse.ok) {
        throw new Error('Failed to fetch passwords for re-encryption');
      }
      
      const passwordsData = await passwordsResponse.json();
      const passwords = passwordsData.passwords || [];
      
      // 3. Get the user's auth salt or generate a new one for the new password
      const saltResponse = await fetchWithCSRF(`${ENDPOINTS.PROFILE}`, {
        method: 'GET'
      });
      
      if (!saltResponse.ok) {
        throw new Error('Failed to retrieve user profile');
      }
      
      const profileData = await saltResponse.json();
      const { authSalt: currentAuthSalt, encryptionSalt: currentEncryptionSalt } = profileData.user;
      
      // Generate a new auth salt for the new password
      const newAuthSalt = crypto.lib.WordArray.random(16).toString();
      
      // Hash the current password with the current auth salt for verification
      const hashedCurrentPassword = crypto.PBKDF2(
        passwordForm.currentPassword,
        currentAuthSalt,
        { keySize: 512/32, iterations: 10000 }
      ).toString();
      
      // Hash the new password with the new auth salt
      const hashedNewPassword = crypto.PBKDF2(
        passwordForm.newPassword,
        newAuthSalt,
        { keySize: 512/32, iterations: 10000 }
      ).toString();
      
      // Generate a new encryption salt for the new password
      const newEncryptionSalt = crypto.lib.WordArray.random(32).toString();
      
      // 3. Change the master password on the server with hashed passwords
      const response = await fetchWithCSRF(`${ENDPOINTS.PROFILE_PASSWORD}`, {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: hashedCurrentPassword,
          newPassword: hashedNewPassword,
          newAuthSalt: newAuthSalt,
          newEncryptionSalt: newEncryptionSalt
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to change master password');
      }
      
      const data = await response.json();
      
      // 4. Generate a new encryption key from the new password
      const newEncryptionKey = await deriveEncryptionKey(passwordForm.newPassword, data.encryptionSalt);
      
      // 5. Re-encrypt all passwords with the new key
      const updatedPasswords = [];
      
      for (const pwd of passwords) {
        try {
          // Decrypt with old key
          let decryptedPassword;
          
          // Check if the password is encrypted (should be a JSON string)
          if (typeof pwd.password === 'string' && pwd.password.startsWith('{')) {
            decryptedPassword = await decryptData(pwd.password, currentEncryptionKey);
          } else {
            // For backward compatibility with non-encrypted passwords
            decryptedPassword = pwd.password;
          }
          
          // Re-encrypt with new key
          const reEncryptedPassword = await encryptData(decryptedPassword, newEncryptionKey);
          
          // Prepare for batch update
          updatedPasswords.push({
            id: pwd.id,
            encryptedPassword: reEncryptedPassword
          });
        } catch (err) {
          console.error(`Failed to re-encrypt password ${pwd.id}:`, err);
          // Continue with other passwords even if one fails
        }
      }
      
      // 6. Update all passwords with new encryption
      if (updatedPasswords.length > 0) {
        const updateResponse = await fetchWithCSRF(`${ENDPOINTS.BATCH_UPDATE_PASSWORDS}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            passwords: updatedPasswords
          }),
        });
        
        if (!updateResponse.ok) {
          throw new Error('Failed to update passwords with new encryption');
        }
      }
      
      // 7. Update the encryption key in memory
      localStorage.setItem('encryptionKey', newEncryptionKey);
      
      // 8. Reset form and show success message
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      toast({
        title: "Password updated",
        description: "Your master password has been changed and all passwords have been re-encrypted.",
      });
    } catch (error) {
      let errorMessage = "Failed to update password. Please try again.";
      
      if (error.type === ErrorTypes.VALIDATION_ERROR) {
        errorMessage = error.message || "Please check your input and try again.";
      } else if (error.type === ErrorTypes.AUTH_ERROR) {
        errorMessage = "Current password is incorrect.";
      } else {
        errorMessage = error.message || "Failed to update password. Please try again.";
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
    console.log('Current 2FA state:', twoFactorEnabled);
    if (twoFactorEnabled) {
      // Disable 2FA
      try {
        setLoading(true);
        const response = await fetchWithCSRF(`${ENDPOINTS.TWO_FACTOR_DISABLE}`, {
          method: 'POST'
        });
        
        console.log('2FA disable response:', response);
        
        // Update UI state
        setTwoFactorEnabled(false);
        setShowQrCode(false);
        toast({
          title: "Two-factor authentication disabled",
          description: "Two-factor authentication has been disabled for your account.",
        });
        
        // Refresh user data to ensure we have the latest state
        await fetchUserData();
      } catch (error) {
        console.error('Error disabling 2FA:', error);
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
        const response = await fetchWithCSRF(`${ENDPOINTS.TWO_FACTOR_SETUP}`, {
          method: 'POST'
        });
        
        if (response) {
          console.log(response);
          setQrCode(response.qrCode);
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
      const response = await fetchWithCSRF(`${ENDPOINTS.TWO_FACTOR_VERIFY}`, {
        method: 'POST',
        body: JSON.stringify({ token: verificationCode })
      });
      
      // fetchWithCSRF returns the parsed JSON data, not a Response object
      console.log('2FA verification response:', response);
      
      // Update the UI to reflect the enabled state
      setTwoFactorEnabled(true);
      setShowQrCode(false);
      setVerificationCode('');
      toast({
        title: "Two-factor authentication enabled",
        description: "Two-factor authentication has been enabled for your account.",
      });
      
      // Refresh user data to ensure we have the latest state
      fetchUserData();
    } catch (error) {
      console.error('Error verifying 2FA:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Invalid verification code. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    try {
      setLoading(true);
      const response = await fetchWithCSRF(ENDPOINTS.PROFILE, {
        method: 'PUT',
        body: JSON.stringify({
          id: userData.id,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          loginNotifications: userData.loginNotifications
        })
      });
      
      console.log('Profile update response:', response);
      
      // fetchWithCSRF already returns the parsed JSON data, not a Response object
      toast({
        title: "Changes saved",
        description: "Your account settings have been updated successfully.",
      });
      
      // Refresh user data to ensure we have the latest state
      await fetchUserData();
    } catch (error) {
      console.error('Error saving profile changes:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save changes. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6 border-b">
        <div className="flex space-x-6 mb-4">
          {tabButtons.map(tab => (
            <button
              key={tab.key}
              className={`pb-2 px-1 font-medium ${activeTab === tab.key ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {activeTab === 'account' && (
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
                readOnly={true}
                defaultValue={userData?.email || ''} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input 
                id="firstName" 
                value={userData?.firstName || ''} 
                placeholder="Your name"
                onChange={(e) => setUserData({ ...userData, firstName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input 
                id="lastName" 
                value={userData?.lastName || ''} 
                placeholder="Your name"
                onChange={(e) => setUserData({ ...userData, lastName: e.target.value })}
              />
            </div>
            <div className="flex items-center space-x-2">
              <ToggleSwitch 
                id="email-notifications" 
                checked={userData?.loginNotifications || false}
                onChange={(e) => setUserData({ ...userData, loginNotifications: e.target.value })}
              />
              <Label htmlFor="email-notifications">Receive email notifications</Label>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSaveChanges}>Save Changes</Button>
          </CardFooter>
        </Card>
      )}
      {activeTab === 'security' && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* 2FA Section */}

          {!twoFactorEnabled && !showQrCode && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account by enabling 2FA.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Button onClick={handleTwoFactorToggle} disabled={loading} className="w-full">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enabling...
                      </>
                    ) : (
                      'Enable Two-Factor Authentication'
                    )}
                  </Button>
                  {loading && (
                    <Alert variant="info" className="mt-2 bg-blue-50">
                      <AlertDescription className="flex items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-500" />
                        Generating QR code. This may take a moment...
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          {!twoFactorEnabled && showQrCode && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Scan QR Code</CardTitle>
                <CardDescription>
                  Scan this QR code with your authenticator app, then enter the code below to verify.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center space-y-4">
                <img
                  src={qrCode}
                  alt="2FA QR Code"
                  className="w-40 h-40 border rounded"
                />
                <Input
                  id="verification-code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter the 6-digit code"
                  maxLength={6}
                  className="w-48"
                />
                <div className="space-y-4 w-full">
                  <Button onClick={verifyTwoFactor} disabled={loading} className="w-full mt-2">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify and Enable'
                    )}
                  </Button>
                  {loading && (
                    <Alert variant="info" className="mt-2 bg-blue-50">
                      <AlertDescription className="flex items-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-500" />
                        Verifying your code. This may take a moment...
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          {twoFactorEnabled && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>
                  2FA is currently enabled for your account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-medium">Backup Codes</h4>
                      <p className="text-sm text-muted-foreground">
                        Generate backup codes to use if you lose access to your authenticator app
                      </p>
                    </div>
                    {/* Add debugging for 2FA state */}
                    {console.log('Settings page - 2FA enabled state:', twoFactorEnabled)}
                    <BackupCodesDialog twoFactorEnabled={twoFactorEnabled} />
                  </div>
                  <div className="border-t pt-4">
                    <Button onClick={handleTwoFactorToggle} disabled={loading} className="w-full">
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Disabling...
                        </>
                      ) : (
                        'Disable 2FA'
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {/* Only show password card if not in 2FA setup mode */}
          {!showQrCode && (
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Input 
                      id="confirm-password" 
                      name="confirmPassword"
                      type={passwordVisible ? "text" : "password"} 
                      value={passwordForm.confirmPassword}
                      onChange={handleInputChange}
                      className={errors.confirmPassword ? "border-red-500" : ""}
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
                  <Button onClick={handlePasswordChange} disabled={loading} className="w-full">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Change Password"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
