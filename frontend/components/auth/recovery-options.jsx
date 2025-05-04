'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Key, AlertTriangle } from 'lucide-react';

export function RecoveryOptions({ 
  onRecoveryOptionsChange, 
  initialOptions = { useBackupCodes: true, useEmailRecovery: false },
  initialEmail = ''
}) {
  const [recoveryOptions, setRecoveryOptions] = useState(initialOptions);
  const [recoveryEmail, setRecoveryEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState('');

  // Validate email format
  const validateEmail = (email) => {
    if (!email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle checkbox changes
  const handleOptionChange = (option, checked) => {
    const newOptions = { ...recoveryOptions, [option]: checked };
    
    // Ensure at least one recovery option is selected
    if (!newOptions.useBackupCodes && !newOptions.useEmailRecovery) {
      return; // Don't allow unchecking both options
    }
    
    setRecoveryOptions(newOptions);
    
    // Notify parent component
    if (onRecoveryOptionsChange) {
      onRecoveryOptionsChange({
        ...newOptions,
        recoveryEmail: newOptions.useEmailRecovery ? recoveryEmail : ''
      });
    }
  };

  // Handle email change
  const handleEmailChange = (e) => {
    const email = e.target.value;
    setRecoveryEmail(email);
    
    // Clear error when typing
    if (emailError) setEmailError('');
    
    // Validate email if not empty
    if (email && !validateEmail(email)) {
      setEmailError('Please enter a valid email address');
    }
    
    // Notify parent component
    if (onRecoveryOptionsChange && recoveryOptions.useEmailRecovery) {
      onRecoveryOptionsChange({
        ...recoveryOptions,
        recoveryEmail: email
      });
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="text-lg font-medium">Account Recovery Options</div>
          <p className="text-sm text-muted-foreground">
            Choose how you want to recover your account if you lose access to your two-factor authentication device.
            At least one recovery option is required.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-start space-x-2">
              <Checkbox 
                id="useBackupCodes" 
                checked={recoveryOptions.useBackupCodes}
                onCheckedChange={(checked) => handleOptionChange('useBackupCodes', checked)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label 
                  htmlFor="useBackupCodes" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center"
                >
                  <Key className="h-4 w-4 mr-2" />
                  Backup Codes
                </Label>
                <p className="text-sm text-muted-foreground">
                  Generate one-time use backup codes to recover your account.
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-2">
              <Checkbox 
                id="useEmailRecovery" 
                checked={recoveryOptions.useEmailRecovery}
                onCheckedChange={(checked) => handleOptionChange('useEmailRecovery', checked)}
              />
              <div className="grid gap-1.5 leading-none w-full">
                <Label 
                  htmlFor="useEmailRecovery" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Email Recovery
                </Label>
                <p className="text-sm text-muted-foreground">
                  Use a recovery email to regain access to your account.
                </p>
                
                {recoveryOptions.useEmailRecovery && (
                  <div className="mt-2">
                    <Input
                      type="email"
                      placeholder="Enter recovery email"
                      value={recoveryEmail}
                      onChange={handleEmailChange}
                      className={emailError ? 'border-red-500' : ''}
                    />
                    {emailError && (
                      <p className="text-xs text-red-500 mt-1">{emailError}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {!recoveryOptions.useBackupCodes && !recoveryOptions.useEmailRecovery && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4 mr-2" />
              <AlertDescription>
                At least one recovery option must be selected.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
